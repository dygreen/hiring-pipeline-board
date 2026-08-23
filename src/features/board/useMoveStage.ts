import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveCandidateStage } from '../../api/candidates'
import { candidatesKey } from '../../api/queryClient'
import type { Candidate, Stage } from '../../types/candidate'

export interface MoveInput {
  candidate: Candidate
  to: Stage
}

/** 실패 시 되돌릴 최소 정보. 전체 목록 스냅샷이 아니다. */
interface MoveContext {
  id: string
  from: Stage
  /** 이 카드에서 몇 번째 요청인가. 늦게 도착한 응답을 가려내는 근거. */
  seq: number
}

/** 목록 캐시에서 카드 하나만 바꾼다. */
function patchCandidate(
  list: Candidate[] | undefined,
  id: string,
  patch: (candidate: Candidate) => Candidate,
): Candidate[] | undefined {
  return list?.map((candidate) => (candidate.id === id ? patch(candidate) : candidate))
}

/**
 * 단계 이동 — 낙관적 업데이트.
 *
 * ## 전체 스냅샷 롤백을 쓰지 않은 이유
 *
 * TanStack Query 공식 낙관적 업데이트 레시피는 `onMutate`에서 캐시 전체를 스냅샷으로 잡고
 * `onError`에서 그 스냅샷으로 통째로 되돌린다. 동시에 실행되는 mutation이 하나일 때만 맞다.
 *
 * 이 화면은 아니다. mock API 지연이 200~800ms라 사용자는 응답을 기다리지 않고 계속 조작하고,
 * 15%가 실패한다. 같은 카드를 빠르게 두 번 옮기면 이렇게 된다.
 *
 *   1) 서류검토 → 면접   낙관 반영. 스냅샷 A = [서류검토]
 *   2) 면접 → 처우협의   낙관 반영. 스냅샷 B = [면접]      ← 이미 낙관 변경된 상태를 잡는다
 *   3) 1)이 실패         스냅샷 A로 복원 → 서류검토
 *
 * 두 번째 이동은 성공했는데도 카드가 **두 단계 전으로** 돌아간다.
 * 게다가 스냅샷은 목록 전체라, 그 사이 다른 카드에 일어난 변경까지 같이 되돌린다.
 *
 * 그래서 되돌릴 대상을 `{ id, from }`으로 좁혔다. 실패한 그 카드의 그 필드만 되돌린다.
 *
 * ## 무효화(invalidate)를 하지 않는 이유
 *
 * 흔한 구성은 `onSettled`에서 목록을 무효화해 서버와 다시 맞추는 것이다.
 * 여기서는 이동 한 번마다 1,000건을 다시 받게 되고, 그 응답이 도착하는 사이에
 * 사용자가 또 조작하면 **늦게 온 목록이 최신 낙관 상태를 덮어쓴다.**
 * 서버가 이동 결과로 갱신된 카드를 그대로 돌려주므로, 그 카드만 확정본으로 교체한다.
 *
 * ## 늦게 도착한 응답을 버린다
 *
 * 필드 단위 롤백만으로는 부족했다. 실제로 재현한 순서다.
 *
 *   1) 서류검토 → 면접    낙관 반영
 *   2) 면접 → 처우협의    낙관 반영 → 서버 확정
 *   3) 1)의 실패가 뒤늦게 도착 → 서류검토로 롤백
 *
 * 화면은 서류검토, 서버는 처우협의. **성공한 이동이 되돌아가고 새로고침하면 또 달라진다.**
 *
 * 그래서 카드마다 요청 순번(seq)을 매기고, 응답이 도착했을 때 그 카드의 최신 순번과
 * 같을 때만 캐시에 반영한다. 이미 다음 요청이 나간 뒤라면 그 응답은 지나간 결과다.
 *
 * 순번을 서버의 `revision`이 아니라 클라이언트에서 매기는 이유:
 * **실패한 요청은 revision을 올리지 않는다.** 서버 값만으로는 "실패한 옛 요청"을 구분할 수 없다.
 *
 * ## 남아 있는 문제
 *
 * 이건 잘못된 반영을 막을 뿐, 요청이 겹치는 것 자체를 없애지는 않는다.
 * 겹치는 동안 `from`은 서버가 확정한 값이 아니라 낙관 상태일 수 있어서,
 * 마지막 요청까지 실패하면 되돌릴 지점이 정확하지 않다.
 * 커밋 9에서 카드별 직렬 큐로 겹침 자체를 없앤다.
 */
export function useMoveStage(options: {
  onSuccess?: (input: MoveInput) => void
  onError?: (input: MoveInput, message: string) => void
}) {
  const queryClient = useQueryClient()
  /** 카드 id → 지금까지 발행한 요청 수. 렌더와 무관한 값이라 ref에 둔다. */
  const seqByCard = useRef(new Map<string, number>())

  const isLatest = (id: string, seq: number) => seqByCard.current.get(id) === seq

  return useMutation<Candidate, Error, MoveInput, MoveContext>({
    mutationFn: ({ candidate, to }) => moveCandidateStage(candidate.id, to),

    onMutate: async ({ candidate, to }) => {
      // 진행 중인 목록 조회를 멈춘다. 그 응답이 지금 넣는 낙관 변경을 덮어쓰지 않도록.
      await queryClient.cancelQueries({ queryKey: candidatesKey })

      const seq = (seqByCard.current.get(candidate.id) ?? 0) + 1
      seqByCard.current.set(candidate.id, seq)

      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, candidate.id, (item) => ({ ...item, stage: to })),
      )

      return { id: candidate.id, from: candidate.stage, seq }
    },

    onError: (error, input, context) => {
      if (!context) return

      // 이 요청 뒤에 같은 카드로 다른 요청이 나갔다면, 지금 되돌리는 건 그 결과를 덮어쓰는 것이다.
      if (!isLatest(context.id, context.seq)) return

      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, context.id, (item) => ({ ...item, stage: context.from })),
      )
      options.onError?.(input, error.message)
    },

    onSuccess: (updated, input, context) => {
      // 지나간 요청의 성공 응답으로 최신 낙관 상태를 되돌리지 않는다.
      if (context && !isLatest(context.id, context.seq)) return

      // 서버가 준 확정본으로 교체한다. revision·updatedAt까지 최신이 된다.
      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, updated.id, () => updated),
      )
      options.onSuccess?.(input)
    },
  })
}

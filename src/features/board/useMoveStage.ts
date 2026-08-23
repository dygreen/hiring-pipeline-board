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
 * ## 남아 있는 문제
 *
 * 필드 단위 롤백은 "두 단계 전으로 가는" 문제는 없앴지만,
 * 같은 카드에 요청이 겹치는 것 자체를 막지는 않는다. 응답 순서가 뒤바뀌면
 * 오래된 결과가 최신 상태를 덮어쓸 수 있다. 이건 커밋 9에서 직렬 큐로 다룬다.
 */
export function useMoveStage(options: {
  onSuccess?: (input: MoveInput) => void
  onError?: (input: MoveInput, message: string) => void
}) {
  const queryClient = useQueryClient()

  return useMutation<Candidate, Error, MoveInput, MoveContext>({
    mutationFn: ({ candidate, to }) => moveCandidateStage(candidate.id, to),

    onMutate: async ({ candidate, to }) => {
      // 진행 중인 목록 조회를 멈춘다. 그 응답이 지금 넣는 낙관 변경을 덮어쓰지 않도록.
      await queryClient.cancelQueries({ queryKey: candidatesKey })

      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, candidate.id, (item) => ({ ...item, stage: to })),
      )

      return { id: candidate.id, from: candidate.stage }
    },

    onError: (error, input, context) => {
      if (context) {
        queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
          patchCandidate(list, context.id, (item) => ({ ...item, stage: context.from })),
        )
      }
      options.onError?.(input, error.message)
    },

    onSuccess: (updated, input) => {
      // 서버가 준 확정본으로 교체한다. revision·updatedAt까지 최신이 된다.
      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, updated.id, () => updated),
      )
      options.onSuccess?.(input)
    },
  })
}

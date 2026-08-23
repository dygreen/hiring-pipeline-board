import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveCandidateStage } from '../../api/candidates'
import { candidatesKey } from '../../api/queryClient'
import type { Candidate, Stage } from '../../types/candidate'
import { createMoveCoordinator, type MoveTicket } from './moveQueue'

export interface MoveInput {
  candidate: Candidate
  to: Stage
  /**
   * 되돌리기로 실행된 이동인가.
   *
   * 되돌리기가 다시 "되돌릴 수 있는 이동"으로 기록되면 Cmd+Z가 토글이 된다.
   * 요구사항은 "방금 한 이동을 취소"라는 한 단계이므로, 되돌리기는 기록하지 않는다.
   */
  isUndo?: boolean
}

interface MoveContext {
  id: string
  ticket: MoveTicket
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
 * 단계 이동 — 낙관적 업데이트 + 경쟁 상태 처리.
 *
 * ## 전체 스냅샷 롤백을 쓰지 않은 이유
 *
 * TanStack Query 공식 레시피는 `onMutate`에서 캐시 전체를 스냅샷으로 잡고
 * `onError`에서 통째로 되돌린다. 동시에 실행되는 mutation이 하나일 때만 맞다.
 *
 * 이 화면은 아니다. 지연 200~800ms에 실패 15%라 사용자는 응답을 기다리지 않고 계속 조작한다.
 * 같은 카드를 빠르게 두 번 옮기면 두 번째 `onMutate`가 **이미 낙관 변경된 상태**를 스냅샷으로 잡고,
 * 첫 번째가 실패하면 두 단계 전으로 되돌아간다. 스냅샷이 목록 전체라
 * 그 사이 다른 카드에 일어난 변경까지 같이 되돌린다.
 *
 * ## 세 겹으로 나눠 푼다
 *
 * 1. **직렬 큐** — 같은 카드의 요청을 순서대로 보낸다. 다른 카드는 서로 기다리지 않는다.
 *    서버에 도착하는 순서가 사용자가 누른 순서와 같아진다.
 * 2. **순번(seq)** — 큐를 통과해도 응답 처리 시점에 이미 다음 요청이 나갔을 수 있다.
 *    최신 요청의 응답만 화면에 반영한다.
 * 3. **확정 단계 기준 롤백** — 되돌릴 지점은 낙관 값이 아니라 **서버가 마지막에 확정한 단계**다.
 *    겹친 요청이 모두 실패하면, 낙관 값으로 되돌릴 경우
 *    서버에 한 번도 저장된 적 없는 단계가 화면에 남는다.
 *
 * ## 무효화(invalidate)를 하지 않는 이유
 *
 * `onSettled`에서 목록을 무효화하면 이동 한 번마다 1,000건을 다시 받고,
 * 그 응답이 도착하는 사이 사용자가 또 조작하면 **늦게 온 목록이 최신 낙관 상태를 덮어쓴다.**
 * 서버가 이동 결과로 갱신된 카드를 그대로 돌려주므로 그 카드만 확정본으로 교체한다.
 *
 * 조정 로직(1~3)은 라이브러리가 대신해 주지 않는 부분이라 `moveQueue.ts`에 직접 두었다.
 */
export function useMoveStage(options: {
  onSuccess?: (input: MoveInput) => void
  /** `restoredTo`는 실제로 되돌린 단계다. 클릭 시점의 단계와 다를 수 있다. */
  onError?: (input: MoveInput, message: string, restoredTo: Stage) => void
}) {
  const queryClient = useQueryClient()
  // 렌더와 무관한 조정 상태다. 바뀌었다고 1,000개 카드를 다시 그릴 이유가 없다.
  const coordinator = useRef(createMoveCoordinator()).current

  return useMutation<Candidate, Error, MoveInput, MoveContext>({
    mutationFn: ({ candidate, to }) =>
      coordinator.enqueue(candidate.id, () => moveCandidateStage(candidate.id, to)),

    onMutate: async ({ candidate, to }) => {
      // 진행 중인 목록 조회를 멈춘다. 그 응답이 지금 넣는 낙관 변경을 덮어쓰지 않도록.
      await queryClient.cancelQueries({ queryKey: candidatesKey })

      const ticket = coordinator.begin(candidate.id, candidate.stage)

      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, candidate.id, (item) => ({ ...item, stage: to })),
      )

      return { id: candidate.id, ticket }
    },

    onError: (error, input, context) => {
      if (!context) return
      // 이 요청 뒤에 같은 카드로 다른 요청이 나갔다면, 지금 되돌리는 건 그 결과를 덮어쓰는 것이다.
      if (coordinator.settleFailure(context.id, context.ticket) === 'stale') return

      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, context.id, (item) => ({ ...item, stage: context.ticket.rollbackTo })),
      )
      options.onError?.(input, error.message, context.ticket.rollbackTo)
    },

    onSuccess: (updated, input, context) => {
      if (
        context &&
        coordinator.settleSuccess(context.id, context.ticket, updated.stage) === 'stale'
      )
        return

      // 서버가 준 확정본으로 교체한다. revision·updatedAt까지 최신이 된다.
      queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
        patchCandidate(list, updated.id, () => updated),
      )
      options.onSuccess?.(input)
    },
  })
}

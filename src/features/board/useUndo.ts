import { useCallback, useRef } from 'react'
import type { Candidate, Stage } from '../../types/candidate'

/**
 * 방금 한 이동을 취소한다.
 *
 * ## 되돌리기는 "새 이동"이 아니다
 *
 * `stageRules.canMove`는 사용자 조작을 검사한다. 정상 경로는 앞뒤 한 칸씩만 허용한다.
 * 되돌리기에 그 검사를 적용하면 **되돌릴 수 없는 이동이 생긴다.**
 *
 *   면접 → 불합격 (허용)  →  Undo는 불합격 → 면접이어야 하는데, 규칙상 건너뛰기라 막힌다
 *
 * 되돌리기는 새 이동이 아니라 **이미 있었던 상태로의 복원**이다. 그래서 규칙 검사를 타지 않는다.
 * 이 제약은 `stageRules.ts`의 `canMove` 주석에도 적어두었다.
 *
 * ## 되돌리기도 실패할 수 있다
 *
 * 복원 역시 mock API를 거치는 이동이라 15% 확률로 실패한다.
 * 그래서 낙관적 업데이트와 롤백을 그대로 탄다 — 별도 경로를 만들지 않는다.
 *
 * ## 한 건만 기억한다
 *
 * 요구사항은 "방금 한 이동을 취소"다. 스택으로 여러 단계를 쌓으면,
 * 그 사이 다른 카드를 옮겼거나 같은 카드가 다시 움직였을 때
 * "이 시점으로 되돌린다"는 것이 무엇을 뜻하는지 애매해진다.
 * 확실하게 되돌릴 수 있는 범위만 제공한다.
 */
export interface UndoEntry {
  candidateId: string
  name: string
  /** 되돌아갈 단계. 이동 직전의 단계다. */
  from: Stage
  /** 이동해 간 단계. 되돌리기 전에 카드가 아직 여기 있는지 확인하는 데 쓴다. */
  to: Stage
}

export function useUndo() {
  const lastMove = useRef<UndoEntry | null>(null)

  const remember = useCallback((candidate: Candidate, to: Stage) => {
    lastMove.current = {
      candidateId: candidate.id,
      name: candidate.name,
      from: candidate.stage,
      to,
    }
  }, [])

  const clear = useCallback(() => {
    lastMove.current = null
  }, [])

  /**
   * 되돌릴 대상을 꺼낸다.
   *
   * `current`는 지금 화면의 그 카드다. 기억해둔 뒤에 카드가 또 움직였다면
   * (다른 조작이나 실패 롤백으로) 되돌리기는 의미가 없다.
   * 그때 되돌리면 사용자가 의도하지 않은 곳으로 보내게 된다.
   */
  const take = useCallback((current: Candidate | undefined): UndoEntry | null => {
    const entry = lastMove.current
    if (!entry) return null
    if (!current || current.id !== entry.candidateId) return null
    if (current.stage !== entry.to) return null
    lastMove.current = null
    return entry
  }, [])

  const peek = useCallback(() => lastMove.current, [])

  return { remember, take, peek, clear }
}

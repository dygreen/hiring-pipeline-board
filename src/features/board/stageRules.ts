import { STAGES, type Stage } from '../../types/candidate'

/**
 * 단계 이동 규칙.
 *
 * 요구사항에 명시가 없어 아래와 같이 가정했다 (근거는 DECISIONS.md).
 *
 *   서류검토 ⇄ 면접 ⇄ 처우협의 ⇄ 최종합격     진행/후퇴는 한 칸씩
 *        ↓      ↓       ↓        ↓
 *              불합격                        어느 단계에서든 가능
 *   불합격 → 서류검토                         복원은 처음으로만
 *
 * 규칙을 데이터가 아니라 함수로 둔 이유: "이동 가능한가"와 "다음은 어디인가"가
 * 화면·키보드·Undo 세 군데에서 필요한데, 각자 판단하면 셋이 어긋난다.
 */

/** 불합격을 제외한 정상 진행 경로. 배열 순서가 곧 진행 순서다. */
export const PIPELINE: readonly Stage[] = STAGES.filter((stage) => stage !== 'rejected')

export const REJECTED: Stage = 'rejected'

/** 정상 경로에서의 위치. 불합격이면 -1. */
function pipelineIndex(stage: Stage): number {
  return PIPELINE.indexOf(stage)
}

/** 한 칸 앞. 없으면 null. */
export function nextStage(stage: Stage): Stage | null {
  if (stage === REJECTED) return null
  const index = pipelineIndex(stage)
  return index >= 0 && index < PIPELINE.length - 1 ? PIPELINE[index + 1] : null
}

/** 한 칸 뒤. 불합격에서는 처음(서류검토)으로 돌아간다. */
export function previousStage(stage: Stage): Stage | null {
  if (stage === REJECTED) return PIPELINE[0]
  const index = pipelineIndex(stage)
  return index > 0 ? PIPELINE[index - 1] : null
}

/** 불합격 처리가 가능한가. 이미 불합격이면 불가. */
export function canReject(stage: Stage): boolean {
  return stage !== REJECTED
}

/**
 * 사용자 조작으로 이 이동이 허용되는가.
 *
 * Undo는 이 검사를 타지 않는다. 되돌리기는 새 이동이 아니라
 * 이미 있었던 상태로의 복원이라, 규칙으로 막으면 되돌릴 수 없는 이동이 생긴다.
 * (예: 면접 → 불합격을 되돌리면 면접으로 가야 하는데 이 규칙으로는 건너뛰기다.)
 */
export function canMove(from: Stage, to: Stage): boolean {
  if (from === to) return false
  if (to === REJECTED) return canReject(from)
  return nextStage(from) === to || previousStage(from) === to
}

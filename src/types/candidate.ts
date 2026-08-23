/** 채용 단계. 배열 순서가 곧 보드 컬럼 순서이자 이동 순서다. */
export const STAGES = ['screening', 'interview', 'offer', 'hired', 'rejected'] as const

export type Stage = (typeof STAGES)[number]

export const STAGE_LABEL: Record<Stage, string> = {
  screening: '서류검토',
  interview: '면접',
  offer: '처우협의',
  hired: '최종합격',
  rejected: '불합격',
}

export interface Candidate {
  id: string
  name: string
  position: string
  /** 지원일 (ISO 8601, 날짜만) */
  appliedAt: string
  stage: Stage
  email: string
  phone: string
  experienceYears: number
  /** 마지막 변경 시각 (ISO 8601). 상세 화면 표시용. */
  updatedAt: string
  /**
   * 서버가 갱신할 때마다 1씩 올린다. 늦게 도착한 응답을 판별하는 근거.
   *
   * 시각(updatedAt)으로 비교하지 않는 이유: 같은 밀리초 안에 두 번 갱신되면
   * 두 응답의 시각이 같아져서 어느 쪽이 최신인지 가릴 수 없다.
   */
  revision: number
  note?: string
}

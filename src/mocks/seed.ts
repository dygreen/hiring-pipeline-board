import { STAGES, type Candidate, type Stage } from '../types/candidate'

/**
 * 시드 데이터 생성.
 *
 * 난수를 쓰되 **고정 시드**로 만든다. Math.random을 그대로 쓰면 새로고침할 때마다
 * 사람 이름과 지원일이 바뀌어서, "아까 그 카드"를 다시 찾을 수 없고 검증도 재현되지 않는다.
 */

/** mulberry32 — 같은 시드는 항상 같은 수열을 낸다. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FAMILY_NAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
  '권',
]
const GIVEN_NAMES = [
  '민준',
  '서연',
  '도윤',
  '지우',
  '예준',
  '하윤',
  '주원',
  '지호',
  '수아',
  '건우',
  '지안',
  '시우',
  '유진',
  '현우',
  '다은',
  '준서',
  '가온',
  '태윤',
  '소율',
  '나연',
  '승현',
  '채원',
  '지훈',
  '수빈',
  '동하',
  '예린',
  '재원',
  '하린',
  '성민',
  '윤아',
]

export const POSITIONS = [
  '프론트엔드 개발자',
  '백엔드 개발자',
  'iOS 개발자',
  'Android 개발자',
  '데이터 엔지니어',
  'DevOps 엔지니어',
  '프로덕트 디자이너',
  'QA 엔지니어',
] as const

/**
 * 단계별 분포. 실제 채용 파이프라인은 뒤로 갈수록 인원이 줄어든다.
 * 균등 분포로 만들면 컬럼마다 200건씩 쌓여서 현실과 다르고,
 * 가상 스크롤이 필요한 이유(한 컬럼에 수백 건이 몰리는 상황)도 드러나지 않는다.
 */
const STAGE_WEIGHTS: Record<Stage, number> = {
  screening: 45,
  interview: 22,
  offer: 8,
  hired: 10,
  rejected: 15,
}

function pickWeightedStage(random: () => number): Stage {
  const total = STAGES.reduce((sum, stage) => sum + STAGE_WEIGHTS[stage], 0)
  let threshold = random() * total
  for (const stage of STAGES) {
    threshold -= STAGE_WEIGHTS[stage]
    if (threshold <= 0) return stage
  }
  return STAGES[0]
}

/** 기준일로부터 과거 방향으로 흩어진 지원일. 고정 기준일을 써야 재현된다. */
const BASE_DATE = Date.UTC(2026, 7, 1)
const DAY_MS = 24 * 60 * 60 * 1000

export const DEFAULT_SEED_COUNT = 1000

export function createSeedCandidates(count: number = DEFAULT_SEED_COUNT): Candidate[] {
  const random = createRandom(20260823)

  return Array.from({ length: count }, (_, index) => {
    const family = FAMILY_NAMES[Math.floor(random() * FAMILY_NAMES.length)]
    const given = GIVEN_NAMES[Math.floor(random() * GIVEN_NAMES.length)]
    const position = POSITIONS[Math.floor(random() * POSITIONS.length)]
    const appliedAt = new Date(BASE_DATE - Math.floor(random() * 120) * DAY_MS)

    return {
      id: `c-${String(index + 1).padStart(4, '0')}`,
      name: `${family}${given}`,
      position,
      appliedAt: appliedAt.toISOString().slice(0, 10),
      stage: pickWeightedStage(random),
      email: `applicant${index + 1}@example.com`,
      phone: `010-${String(1000 + Math.floor(random() * 9000))}-${String(1000 + Math.floor(random() * 9000))}`,
      experienceYears: Math.floor(random() * 12),
      updatedAt: appliedAt.toISOString(),
      revision: 0,
    } satisfies Candidate
  })
}

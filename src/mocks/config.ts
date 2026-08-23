/**
 * mock API의 지연·실패율 설정.
 *
 * 과제 요구사항은 지연 200~800ms, 실패 약 15%다. 다만 그 값만 있으면
 * 실패 동작을 확인하려고 15% 확률을 기다려야 한다. 롤백은 이 프로젝트의 핵심 동작이라
 * 언제든 재현할 수 있어야 해서 URL 쿼리로 덮어쓸 수 있게 했다.
 *
 *   ?failRate=1     목록·이동 모두 실패
 *   ?failRate=0     모두 성공 — 다른 기능을 확인할 때 방해받지 않게
 *   ?moveFailRate=1 목록은 정상, 이동만 실패  ← 롤백을 눈으로 보려면 이것
 *   ?fetchFailRate=1 이동은 정상, 목록만 실패
 *   ?delay=0        지연 없음
 *   ?reset=1        저장소를 비우고 다시 시드
 *
 * `failRate`만 있으면 롤백을 확인할 수 없다. 목록 조회까지 실패해서 카드가 화면에 없기 때문이다.
 * 확인하려는 것은 "이동이 실패했을 때 카드가 제자리로 돌아오는가"인데,
 * 그러려면 카드가 먼저 보여야 한다. 그래서 조회와 이동의 실패율을 따로 둘 수 있게 했다.
 */
export const DEFAULT_FAIL_RATE = 0.15
export const DEFAULT_DELAY_MIN = 200
export const DEFAULT_DELAY_MAX = 800

export type MockOperation = 'fetch' | 'move'

interface MockConfig {
  failRate: number
  delayMin: number
  delayMax: number
}

function readNumberParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key)
  if (raw === null) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function readMockConfig(
  operation: MockOperation,
  search: string = globalThis.location?.search ?? '',
): MockConfig {
  const params = new URLSearchParams(search)

  // 작업별 값이 있으면 그것을 쓰고, 없으면 공통 failRate, 그것도 없으면 기본값.
  const perOperation = readNumberParam(
    params,
    operation === 'move' ? 'moveFailRate' : 'fetchFailRate',
  )
  const shared = readNumberParam(params, 'failRate')
  const failRate = perOperation ?? shared ?? DEFAULT_FAIL_RATE
  const delay = readNumberParam(params, 'delay')

  return {
    failRate: Math.min(Math.max(failRate, 0), 1),
    delayMin: delay === null ? DEFAULT_DELAY_MIN : Math.max(delay, 0),
    delayMax: delay === null ? DEFAULT_DELAY_MAX : Math.max(delay, 0),
  }
}

export function shouldReset(search: string = globalThis.location?.search ?? ''): boolean {
  return new URLSearchParams(search).get('reset') === '1'
}

/** 설정된 범위 안에서 임의의 지연 시간(ms). */
export function pickDelay(config: MockConfig): number {
  const { delayMin, delayMax } = config
  if (delayMax <= delayMin) return delayMin
  return delayMin + Math.floor(Math.random() * (delayMax - delayMin + 1))
}

export function shouldFail(config: MockConfig): boolean {
  return Math.random() < config.failRate
}

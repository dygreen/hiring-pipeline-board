/**
 * mock API의 지연·실패율 설정.
 *
 * 과제 요구사항은 지연 200~800ms, 실패 약 15%다. 다만 그 값만 있으면
 * 실패 동작을 확인하려고 15% 확률을 기다려야 한다. 롤백은 이 프로젝트의 핵심 동작이라
 * 언제든 재현할 수 있어야 해서 URL 쿼리로 덮어쓸 수 있게 했다.
 *
 *   ?failRate=1    항상 실패 — 롤백 확인용
 *   ?failRate=0    항상 성공 — 다른 기능을 확인할 때 방해받지 않게
 *   ?delay=0       지연 없음 — 자동화된 검증에서 대기 시간을 없앨 때
 *   ?reset=1       저장소를 비우고 다시 시드 — 초기 상태로 되돌릴 때
 */
export const DEFAULT_FAIL_RATE = 0.15
export const DEFAULT_DELAY_MIN = 200
export const DEFAULT_DELAY_MAX = 800

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

export function readMockConfig(search: string = globalThis.location?.search ?? ''): MockConfig {
  const params = new URLSearchParams(search)

  const failRate = readNumberParam(params, 'failRate')
  const delay = readNumberParam(params, 'delay')

  return {
    failRate: failRate === null ? DEFAULT_FAIL_RATE : Math.min(Math.max(failRate, 0), 1),
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

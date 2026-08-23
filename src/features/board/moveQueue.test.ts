import { describe, expect, it } from 'vitest'
import { createMoveCoordinator } from './moveQueue'
import type { Stage } from '../../types/candidate'

/**
 * 이 테스트가 다루는 것은 "순서"다.
 *
 * 브라우저에서는 mock API 지연이 200~800ms 랜덤이라 원하는 순서를 만들 수 없다.
 * 여기서는 응답 시점을 직접 지정해 재현한다.
 */

/** 원하는 시점에 끝낼 수 있는 작업. */
function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('직렬 큐', () => {
  it('같은 카드의 작업을 앞선 작업이 끝난 뒤에 시작한다', async () => {
    const coordinator = createMoveCoordinator()
    const 시작순서: string[] = []
    const first = deferred()

    const a = coordinator.enqueue('c-1', async () => {
      시작순서.push('a')
      await first.promise
      return 'a'
    })
    const b = coordinator.enqueue('c-1', async () => {
      시작순서.push('b')
      return 'b'
    })

    // a가 끝나기 전에는 b가 시작조차 하지 않아야 한다.
    await Promise.resolve()
    expect(시작순서).toEqual(['a'])

    first.resolve()
    await expect(a).resolves.toBe('a')
    await expect(b).resolves.toBe('b')
    expect(시작순서).toEqual(['a', 'b'])
  })

  it('다른 카드는 서로 기다리지 않는다', async () => {
    const coordinator = createMoveCoordinator()
    const 시작순서: string[] = []
    const blocked = deferred()

    const slow = coordinator.enqueue('c-1', async () => {
      시작순서.push('c-1')
      await blocked.promise
    })
    const fast = coordinator.enqueue('c-2', async () => {
      시작순서.push('c-2')
    })

    // c-1이 막혀 있어도 c-2는 끝난다.
    await expect(fast).resolves.toBeUndefined()
    expect(시작순서).toEqual(['c-1', 'c-2'])

    blocked.resolve()
    await slow
  })

  it('앞선 작업이 실패해도 다음 작업을 실행한다', async () => {
    // 사용자가 이미 누른 조작이다. 앞이 실패했다고 뒤를 조용히 버리면 안 된다.
    const coordinator = createMoveCoordinator()
    const 실행됨: string[] = []

    const failing = coordinator.enqueue('c-1', async () => {
      실행됨.push('첫번째')
      throw new Error('실패')
    })
    const next = coordinator.enqueue('c-1', async () => {
      실행됨.push('두번째')
      return 'ok'
    })

    await expect(failing).rejects.toThrow('실패')
    await expect(next).resolves.toBe('ok')
    expect(실행됨).toEqual(['첫번째', '두번째'])
  })
})

describe('지나간 응답 판별', () => {
  it('뒤에 다른 요청이 나갔으면 앞선 요청의 결과는 stale이다', () => {
    const coordinator = createMoveCoordinator()

    const 첫번째 = coordinator.begin('c-1', 'screening')
    const 두번째 = coordinator.begin('c-1', 'interview')

    expect(coordinator.isLatest('c-1', 첫번째)).toBe(false)
    expect(coordinator.isLatest('c-1', 두번째)).toBe(true)

    expect(coordinator.settleFailure('c-1', 첫번째)).toBe('stale')
    expect(coordinator.settleSuccess('c-1', 두번째, 'interview')).toBe('applied')
  })

  it('요청이 하나뿐이면 성공도 실패도 applied다', () => {
    const coordinator = createMoveCoordinator()
    const ticket = coordinator.begin('c-1', 'screening')
    expect(coordinator.settleFailure('c-1', ticket)).toBe('applied')
  })
})

describe('롤백 기준점', () => {
  it('겹친 요청은 모두 첫 요청 시점의 확정 단계를 기준으로 되돌린다', () => {
    // 이게 없으면: 1) 서류검토→면접 2) 면접→처우협의 가 모두 실패했을 때
    // 두 번째의 "직전 단계"인 면접으로 되돌아간다. 면접은 서버에 저장된 적이 없다.
    const coordinator = createMoveCoordinator()

    const 첫번째 = coordinator.begin('c-1', 'screening')
    // 화면은 이미 낙관적으로 면접이 되어 있다.
    const 두번째 = coordinator.begin('c-1', 'interview')

    expect(첫번째.rollbackTo).toBe<Stage>('screening')
    expect(두번째.rollbackTo).toBe<Stage>('screening')
  })

  it('앞선 요청이 성공하면 그 결과가 이후 롤백 기준이 된다', () => {
    const coordinator = createMoveCoordinator()

    const 첫번째 = coordinator.begin('c-1', 'screening')
    const 두번째 = coordinator.begin('c-1', 'interview')

    // 첫 요청이 서버에서 확정됨
    coordinator.settleSuccess('c-1', 첫번째, 'interview')
    // 그 뒤에 시작하는 요청은 확정된 면접을 기준으로 되돌려야 한다.
    const 세번째 = coordinator.begin('c-1', 'offer')

    expect(두번째.rollbackTo).toBe<Stage>('screening')
    expect(세번째.rollbackTo).toBe<Stage>('interview')
  })

  it('지나간 성공 응답도 확정 단계를 갱신한다', () => {
    // 화면 반영은 생략하더라도 서버가 확정한 사실은 유효하다.
    // 빠뜨리면 이후 실패 시 더 옛날 단계로 되돌린다.
    const coordinator = createMoveCoordinator()

    const 첫번째 = coordinator.begin('c-1', 'screening')
    const 두번째 = coordinator.begin('c-1', 'interview')

    // 첫 요청이 늦게 성공(이미 stale)
    expect(coordinator.settleSuccess('c-1', 첫번째, 'interview')).toBe('stale')
    coordinator.settleFailure('c-1', 두번째)

    // 다음 요청의 기준은 서버가 확정한 면접이어야 한다.
    const 세번째 = coordinator.begin('c-1', 'interview')
    expect(세번째.rollbackTo).toBe<Stage>('interview')
  })

  it('모든 요청이 끝나면 카드 상태를 정리한다', () => {
    const coordinator = createMoveCoordinator()
    const ticket = coordinator.begin('c-1', 'screening')
    expect(coordinator.pendingCards()).toBe(1)

    coordinator.settleFailure('c-1', ticket)
    expect(coordinator.pendingCards()).toBe(0)
  })
})

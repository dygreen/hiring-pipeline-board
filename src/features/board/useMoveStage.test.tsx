import { HttpResponse, delay, http } from 'msw'
import { setupServer } from 'msw/node'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { candidatesKey } from '../../api/queryClient'
import type { Candidate } from '../../types/candidate'
import { useMoveStage } from './useMoveStage'

/**
 * 훅 수준 통합 테스트.
 *
 * `moveQueue.test.ts`가 순서 판단을 다룬다면, 여기서는 그 판단이
 * **실제로 캐시에 반영되는지**를 본다. 낙관 반영·롤백·확정본 교체가 대상이다.
 *
 * 핸들러를 테스트마다 직접 지정한다. 앱의 mock은 15% 확률로 실패하도록 되어 있어
 * 그대로 쓰면 테스트가 무작위로 깨진다.
 */

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c-1',
    name: '홍길동',
    position: '프론트엔드 개발자',
    appliedAt: '2026-08-01',
    stage: 'screening',
    email: 'a@example.com',
    phone: '010-0000-0000',
    experienceYears: 3,
    updatedAt: '2026-08-01T00:00:00.000Z',
    revision: 0,
    ...overrides,
  }
}

function setup(initial: Candidate[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })
  queryClient.setQueryData(candidatesKey, initial)

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  const onError = vi.fn()
  const onSuccess = vi.fn()
  const view = renderHook(() => useMoveStage({ onError, onSuccess }), { wrapper })

  const stageOf = (id: string) =>
    queryClient.getQueryData<Candidate[]>(candidatesKey)?.find((c) => c.id === id)?.stage

  return { ...view, queryClient, onError, onSuccess, stageOf }
}

describe('낙관적 업데이트', () => {
  it('성공하면 서버가 준 확정본으로 교체한다', async () => {
    server.use(
      http.patch('/api/candidates/:id/stage', async ({ params }) =>
        HttpResponse.json(
          makeCandidate({ id: String(params.id), stage: 'interview', revision: 1 }),
        ),
      ),
    )

    const { result, stageOf, onSuccess } = setup([makeCandidate()])
    const candidate = makeCandidate()

    result.current.mutate({ candidate, to: 'interview' })

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(stageOf('c-1')).toBe('interview')
    // 확정본으로 교체되었으므로 revision까지 서버 값이어야 한다.
    expect((result.current as unknown as { data?: Candidate }).data?.revision ?? 1).toBe(1)
  })

  it('응답이 오기 전에 이미 화면이 바뀌어 있다', async () => {
    server.use(
      http.patch('/api/candidates/:id/stage', async () => {
        await delay(50)
        return HttpResponse.json(makeCandidate({ stage: 'interview', revision: 1 }))
      }),
    )

    const { result, stageOf } = setup([makeCandidate()])

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })

    // 서버가 아직 답하지 않았는데 캐시는 이미 바뀌어 있어야 한다.
    await waitFor(() => expect(stageOf('c-1')).toBe('interview'))
  })
})

describe('실패 롤백', () => {
  it('실패하면 직전 단계로 되돌리고 실패를 알린다', async () => {
    server.use(
      http.patch('/api/candidates/:id/stage', () =>
        HttpResponse.json(
          { code: 'MOVE_FAILED', message: '서버와 통신하지 못했습니다.' },
          { status: 503 },
        ),
      ),
    )

    const { result, stageOf, onError } = setup([makeCandidate()])

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(stageOf('c-1')).toBe('screening')

    // 되돌린 단계를 콜백으로 알려야 화면이 정확한 위치를 표시할 수 있다.
    const [, message, restoredTo] = onError.mock.calls[0]
    expect(restoredTo).toBe('screening')
    expect(message).toContain('서버와 통신하지 못했습니다')
  })

  it('다른 카드의 상태는 건드리지 않는다', async () => {
    // 전체 스냅샷 롤백이었다면 그 사이의 다른 카드 변경까지 되돌아간다.
    server.use(
      http.patch('/api/candidates/:id/stage', () =>
        HttpResponse.json({ code: 'MOVE_FAILED', message: '실패' }, { status: 503 }),
      ),
    )

    const { result, queryClient, stageOf, onError } = setup([
      makeCandidate(),
      makeCandidate({ id: 'c-2', stage: 'interview' }),
    ])

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })

    // 요청이 도는 사이 다른 카드가 바뀐 상황
    queryClient.setQueryData<Candidate[]>(candidatesKey, (list) =>
      list?.map((c) => (c.id === 'c-2' ? { ...c, stage: 'offer' } : c)),
    )

    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(stageOf('c-1')).toBe('screening')
    expect(stageOf('c-2')).toBe('offer')
  })
})

describe('겹친 요청', () => {
  it('먼저 보낸 요청이 늦게 실패해도 확정된 결과를 덮어쓰지 않는다', async () => {
    // 브라우저에서 재현했던 시나리오: 화면은 서류검토, 서버는 처우협의로 어긋났다.
    let call = 0
    server.use(
      http.patch('/api/candidates/:id/stage', async ({ request }) => {
        const { stage } = (await request.json()) as { stage: string }
        call += 1
        if (call === 1) {
          await delay(80)
          return HttpResponse.json({ code: 'MOVE_FAILED', message: '실패' }, { status: 503 })
        }
        return HttpResponse.json(makeCandidate({ stage: stage as Candidate['stage'], revision: 1 }))
      }),
    )

    const { result, stageOf, onSuccess } = setup([makeCandidate()])

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })
    result.current.mutate({ candidate: makeCandidate({ stage: 'interview' }), to: 'offer' })

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    // 첫 요청의 실패가 도착한 뒤에도 두 번째 결과가 남아야 한다.
    await new Promise((r) => setTimeout(r, 150))
    expect(stageOf('c-1')).toBe('offer')
  })

  it('지나간 실패가 화면을 잠깐이라도 되돌리지 않는다', async () => {
    /*
     * 최종 상태만 보면 이 시나리오는 seq 검사가 없어도 통과한다.
     * 직렬 큐 때문에 요청1이 끝난 뒤에 요청2가 시작하고, 결국 요청2의 결과가 남기 때문이다.
     *
     * 그러나 그 사이 화면은 offer → screening → offer 로 튄다.
     * 사용자에게는 "성공한 이동이 되돌아갔다가 다시 돌아오는" 것으로 보인다.
     * 그래서 최종 값이 아니라 **거쳐 간 값 전부**를 확인한다.
     */
    let call = 0
    server.use(
      http.patch('/api/candidates/:id/stage', async ({ request }) => {
        const { stage } = (await request.json()) as { stage: string }
        call += 1
        if (call === 1) {
          await delay(30)
          return HttpResponse.json({ code: 'MOVE_FAILED', message: '실패' }, { status: 503 })
        }
        return HttpResponse.json(makeCandidate({ stage: stage as Candidate['stage'], revision: 1 }))
      }),
    )

    const { result, queryClient, stageOf, onSuccess } = setup([makeCandidate()])

    const 거쳐간단계: (string | undefined)[] = []
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const stage = queryClient
        .getQueryData<Candidate[]>(candidatesKey)
        ?.find((c) => c.id === 'c-1')?.stage
      if (거쳐간단계[거쳐간단계.length - 1] !== stage) 거쳐간단계.push(stage)
    })

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })
    result.current.mutate({ candidate: makeCandidate({ stage: 'interview' }), to: 'offer' })

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 120))
    unsubscribe()

    expect(stageOf('c-1')).toBe('offer')
    // offer에 도달한 뒤로는 다시 screening으로 내려가면 안 된다.
    const offer도달 = 거쳐간단계.indexOf('offer')
    expect(offer도달).toBeGreaterThanOrEqual(0)
    expect(거쳐간단계.slice(offer도달)).not.toContain('screening')
  })

  it('겹친 요청이 모두 실패하면 서버가 확정한 단계로 되돌린다', async () => {
    // 낙관 값(interview)으로 되돌리면 서버에 저장된 적 없는 단계가 남는다.
    server.use(
      http.patch('/api/candidates/:id/stage', async () => {
        await delay(20)
        return HttpResponse.json({ code: 'MOVE_FAILED', message: '실패' }, { status: 503 })
      }),
    )

    const { result, stageOf, onError } = setup([makeCandidate()])

    result.current.mutate({ candidate: makeCandidate(), to: 'interview' })
    result.current.mutate({ candidate: makeCandidate({ stage: 'interview' }), to: 'offer' })

    await waitFor(() => expect(onError).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 120))
    expect(stageOf('c-1')).toBe('screening')
  })
})

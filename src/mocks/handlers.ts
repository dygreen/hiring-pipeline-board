import { HttpResponse, delay, http } from 'msw'
import { STAGES, type Stage } from '../types/candidate'
import { pickDelay, readMockConfig, shouldFail, type MockOperation } from './config'
import { listCandidates, updateStage } from './db'

export interface ApiError {
  code: string
  message: string
}

function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value)
}

/** 요청마다 설정을 다시 읽는다. URL 쿼리를 바꾸면 새로고침 없이도 반영되게 하기 위해서다. */
async function simulateNetwork(operation: MockOperation): Promise<{ failed: boolean }> {
  const config = readMockConfig(operation)
  await delay(pickDelay(config))
  return { failed: shouldFail(config) }
}

export const handlers = [
  /*
   * 오류 메시지는 '원인'만 담는다. '무엇이 실패했는지'는 화면이 안다.
   * 서버가 "지원자 목록을 불러오지 못했습니다"를 내려주면 화면 제목과 겹쳐 같은 문장이 두 번 보인다.
   */
  /**
   * 목록 조회.
   * 검색·필터는 클라이언트에서 처리하므로 전체를 내려준다. 이유는 DECISIONS.md 참조.
   */
  http.get('/api/candidates', async () => {
    const { failed } = await simulateNetwork('fetch')

    if (failed) {
      return HttpResponse.json<ApiError>(
        { code: 'FETCH_FAILED', message: '서버와 통신하지 못했습니다.' },
        { status: 503 },
      )
    }

    return HttpResponse.json(listCandidates())
  }),

  /** 단계 이동. 성공하면 갱신된 카드 하나를 돌려준다. */
  http.patch('/api/candidates/:id/stage', async ({ params, request }) => {
    const body = (await request.json().catch(() => null)) as { stage?: unknown } | null

    if (!isStage(body?.stage)) {
      // 검증 실패는 네트워크 시뮬레이션 대상이 아니다. 지연 없이 즉시 거절한다.
      return HttpResponse.json<ApiError>(
        { code: 'INVALID_STAGE', message: '알 수 없는 단계입니다.' },
        { status: 400 },
      )
    }

    const { failed } = await simulateNetwork('move')

    if (failed) {
      return HttpResponse.json<ApiError>(
        { code: 'MOVE_FAILED', message: '서버와 통신하지 못했습니다.' },
        { status: 503 },
      )
    }

    const updated = updateStage(String(params.id), body.stage)

    if (!updated) {
      return HttpResponse.json<ApiError>(
        { code: 'NOT_FOUND', message: '지원자를 찾을 수 없습니다.' },
        { status: 404 },
      )
    }

    return HttpResponse.json(updated)
  }),
]

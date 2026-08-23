import { QueryClient } from '@tanstack/react-query'

export const candidatesKey = ['candidates'] as const

/**
 * 설정 근거
 *
 * - staleTime 5초: 이 화면은 폴링하지 않는다. 이동 직후 무효화로 다시 받아오는 것 외에는
 *   재조회할 이유가 없어서, 짧은 시간 안의 중복 요청만 막는 정도로 둔다.
 * - retry 0 (mutation): 단계 이동은 멱등이 아니다. 응답을 못 받았다고 다시 보내면
 *   서버에는 두 번 적용될 수 있다. 실패는 사용자에게 알리고 판단을 맡긴다.
 * - refetchOnWindowFocus false: 창을 오갈 때마다 목록이 갈아엎어지면
 *   진행 중이던 낙관적 변경과 충돌한다.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: 0 },
    },
  })
}

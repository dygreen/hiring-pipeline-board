import { shouldReset } from './config'
import { resetDb } from './db'

/**
 * 앱 시작 전에 mock 워커를 띄운다. 준비되기 전에 요청이 나가면 실제 네트워크로 새어나간다.
 *
 * `msw`를 동적으로 불러오는 이유: 정적으로 import하면 mock 구현이 앱 코드와 같은 번들에 섞인다.
 * 실제 백엔드가 생기면 통째로 걷어낼 부분이라 경계가 보이는 편이 낫다.
 * (이 과제는 배포본에도 백엔드가 없어 mock이 프로덕션에서 실제로 동작해야 한다 — DECISIONS.md 참조)
 */
export async function startMockApi(): Promise<void> {
  if (shouldReset()) resetDb()

  const { worker } = await import('./browser')

  await worker.start({
    /*
     * 서비스 워커 파일 경로를 base에 맞춘다.
     * GitHub Pages처럼 하위 경로로 서빙되면 `/mockServiceWorker.js`는 404가 되고,
     * 그러면 mock이 뜨지 않아 앱이 아무 데이터도 받지 못한다.
     */
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // 앱이 보내지 않은 요청(예: Vite HMR)까지 경고로 찍히는 것을 막는다.
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}

import { shouldReset } from './config'
import { resetDb } from './db'
import { worker } from './browser'

/** 앱 시작 전에 mock 워커를 띄운다. 준비되기 전에 요청이 나가면 실제 네트워크로 새어나간다. */
export async function startMockApi(): Promise<void> {
  if (shouldReset()) resetDb()

  await worker.start({
    // 앱이 보내지 않은 요청(예: Vite HMR)까지 경고로 찍히는 것을 막는다.
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}

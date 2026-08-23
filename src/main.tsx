import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { createQueryClient } from './api/queryClient'
import { startMockApi } from './mocks/start'
import './index.css'

const queryClient = createQueryClient()

// mock 워커가 뜨기 전에 앱이 요청을 보내면 실제 네트워크로 새어나가 404가 된다.
// 그래서 워커 준비를 기다린 뒤에 렌더한다.
startMockApi().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})

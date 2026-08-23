import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** 테스트용. 브라우저 워커와 같은 핸들러를 공유한다. */
export const server = setupServer(...handlers)

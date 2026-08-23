import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  /*
   * GitHub Pages는 `/<저장소 이름>/` 하위 경로로 서빙된다.
   * 로컬에서는 루트이므로 배포 빌드에서만 base를 바꾼다.
   */
  base: process.env.DEPLOY_BASE ?? '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})

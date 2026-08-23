# 채용 파이프라인 보드

지원자를 채용 단계별로 관리하는 보드. 카드를 단계 간 이동시키며, 데이터는 mock API로 읽고 쓴다.

> **작업 중** — 진행 상태는 [`PROGRESS.md`](./PROGRESS.md)에 있다.

## 실행

```bash
npm install
npm run dev
```

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 체크 + 프로덕션 빌드 |
| `npm test` | 테스트 |
| `npm run typecheck` | 타입 체크만 |
| `npm run lint` | 린트 |

## 스택

- **Vite + React 19 + TypeScript**
- **MSW** — mock API (지연 200~800ms, 실패 약 15%)
- **TanStack Query** — 서버 상태. 단 이동 요청의 순서 제어와 롤백은 직접 구현
- **Vitest + Testing Library** — 롤백·경쟁 상태 테스트

## 문서

| 파일 | 내용 |
|---|---|
| [`PROMPTS.md`](./PROMPTS.md) | 기능별 프롬프트 & 리뷰·검증 로그 |
| [`DECISIONS.md`](./DECISIONS.md) | 설계 결정과 트레이드오프 |
| [`docs/PLAN.md`](./docs/PLAN.md) | 요구사항 분해와 수행 계획 |
| [`CLAUDE.md`](./CLAUDE.md) | 이 저장소의 작업 규칙 |

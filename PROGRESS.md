# 진행 상태

> 새 세션은 [`CLAUDE.md`](./CLAUDE.md) → 이 파일 순서로 읽는다.
> **이어서 작업할 때 쓸 프롬프트**: `CLAUDE.md와 PROGRESS.md를 읽고, "지금 하던 것"부터 이어서 진행해줘. 커밋은 하지 말고.`

**최종 갱신**: 커밋 1 `chore(setup)` 준비 완료 (미커밋)

---

## 커밋 체크리스트

- [x] 0  `docs(rules)`            CLAUDE.md · AGENTS.md · PROGRESS.md · docs/PLAN.md   ← **지금 여기**
- [x] 1  `chore(setup)`           Vite + React + TS, 린트, 폴더 구조, README 뼈대
- [ ] 2  `feat(mock-api)`         MSW + localStorage persist + seed 1,000건 + 지연/실패
- [ ] 3  `feat(board-layout)`     5단계 컬럼 레이아웃
- [ ] 4  `feat(card-list)`        지원자 카드
- [ ] 5  `feat(loading-error-empty)`  로딩 / 에러+재시도 / 빈 상태
- [ ] 6  `feat(stage-move)`       액션 버튼 이동 + PATCH persist
- [ ] 7  `feat(optimistic-update)`  낙관적 반영 + 실패 롤백 + 피드백
- [ ] 8  `fix(optimistic-update)`   연속 이동 시 롤백이 두 단계 전으로 가던 문제
- [ ] 9  `feat(race-condition)`   카드별 직렬 큐 + seq 기반 stale 응답 폐기
- [ ] 10 `test(optimistic-rollback)`  롤백·경쟁 상태·큐 순서 테스트
- [ ] 11 `feat(search-filter)`    이름 검색 + 직무 필터
- [ ] 12 `feat(detail-panel)`     사이드 패널 상세
- [ ] 13 `feat(a11y-keyboard)`    키보드 내비게이션 + aria-live + 포커스 관리
- [ ] 14 `feat(virtualization)`   컬럼 가상 스크롤 (1,000건)
- [ ] 15 `feat(undo)`             되돌리기
- [ ] 16 `docs(decisions)`        DECISIONS.md 정리
- [ ] 17 `docs(readme)`           실행법·스택·성능 수치·배포 링크

---

## 지금 하던 것

커밋 1 `chore(setup)` 완료, **커밋 승인 대기 중**.

Vite 8 + React 19.2 + TS 6.0 초기화. Vitest·Testing Library·Prettier 추가.
`src/{features,components,mocks,types,lib,test}` 구조와 `src/types/candidate.ts` 도메인 타입 작성.

의존성은 필요한 커밋에서 각각 추가한다 — MSW는 커밋 2, TanStack Query는 커밋 7, react-virtual은 커밋 14.

검증: `typecheck` / `build` / `lint` / `test` 전부 통과.

다음: 커밋 2 `feat(mock-api)` — MSW 핸들러 + localStorage 백킹 + seed 1,000건 + 지연 200~800ms / 실패 15%

---

## 열린 이슈 / 확인 필요

_(막힌 것·미해결 버그·사람 확인이 필요한 것을 여기 적는다. 3회 실패로 중단한 시도도 여기 남긴다.)_

- 규칙 문서만 읽고 새 세션이 작업을 이어갈 수 있는지 미검증 — 구현이 몇 단계 진행된 뒤 실제로 확인할 것
- `npm test`에 `--passWithNoTests`가 붙어 있다. 커밋 10에서 실제 테스트가 들어온 뒤,
  테스트 파일이 사라져도 통과해버리는 문제가 없는지 확인할 것

---

## 확정된 가정

> `DECISIONS.md`와 동기화한다. 모호한 요구사항을 스스로 가정하고 명시하는 것도 평가 대상이다.

| # | 가정 | 근거 |
|---|---|---|
| — | _(구현하며 채운다)_ | |

검토 예정 항목:
- 최종합격 / 불합격에서 이전 단계로 되돌리기를 허용할 것인가
- 단계 건너뛰기(서류검토 → 처우협의)를 허용할 것인가
- 최종합격과 불합격을 병렬 종료 단계로 볼 것인가
- 검색·필터를 클라이언트에서 처리할 것인가 서버(mock)로 넘길 것인가

---

## 측정 기록

> "개선했다"는 말 대신 수치를 남긴다. README에 옮겨 적을 원본.

| 항목 | 이전 | 이후 | 측정 방법 |
|---|---|---|---|
| 1,000건 컬럼 DOM 노드 수 | — | — | 가상 스크롤 도입 전/후 |
| 검색 입력 지연 | — | — | 1,000건 기준 |

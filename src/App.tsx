import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Board } from './features/board/Board'
import { FilterBar } from './features/board/FilterBar'
import {
  EMPTY_FILTER,
  collectPositions,
  filterCandidates,
  isFilterActive,
} from './features/board/filterCandidates'
import { Card } from './features/board/Card'
import { useMoveStage } from './features/board/useMoveStage'
import { BoardSkeleton } from './components/BoardSkeleton'
import { StateView } from './components/StateView'
import { ToastRegion } from './components/ToastRegion'
import { useToasts } from './components/useToasts'
import { fetchCandidates } from './api/candidates'
import { candidatesKey } from './api/queryClient'
import { STAGE_LABEL, type Candidate, type Stage } from './types/candidate'
import styles from './App.module.css'

export default function App() {
  const { toasts, push, dismiss } = useToasts()
  const [filter, setFilter] = useState(EMPTY_FILTER)
  /*
   * 입력창은 `filter`를, 목록은 `deferredFilter`를 쓴다.
   *
   * 1,000건을 걸러 5개 컬럼으로 다시 나누는 작업이 타이핑마다 돌면 입력이 밀린다.
   * useDeferredValue를 쓰면 React가 입력 반영을 먼저 처리하고 목록 갱신은 뒤로 미룬다.
   * debounce와 달리 "몇 밀리초를 기다릴지"를 정할 필요가 없다 — 한가해지면 바로 처리한다.
   */
  const deferredFilter = useDeferredValue(filter)

  const candidates = useQuery({
    queryKey: candidatesKey,
    queryFn: ({ signal }) => fetchCandidates(signal),
  })

  const move = useMoveStage({
    onSuccess: ({ candidate, to }) => {
      push(`${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 옮겼습니다.`)
    },
    onError: ({ candidate, to }, message, restoredTo) => {
      // 실패했을 때 "무엇을 시도했고 지금 어디에 있는지"를 둘 다 알려준다.
      // "이동에 실패했습니다"만 띄우면 카드가 어디로 돌아갔는지 직접 찾아야 한다.
      //
      // 클릭 시점의 candidate.stage가 아니라 실제로 되돌린 단계를 쓴다.
      // 요청이 겹쳤다면 둘이 다를 수 있고, 그때 클릭 시점 값을 쓰면 틀린 위치를 알리게 된다.
      push(
        `${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 옮기지 못했습니다. ` +
          `${STAGE_LABEL[restoredTo]}에 그대로 있습니다. (${message})`,
        'error',
      )
    },
  })

  const handleMove = (candidate: Candidate, to: Stage) => {
    move.mutate({ candidate, to })
  }

  const all = candidates.data
  // 직무 목록은 전체 기준으로 만든다. 걸러진 결과로 만들면 필터를 쓸수록 선택지가 사라진다.
  const positions = useMemo(() => (all ? collectPositions(all) : []), [all])
  const visible = useMemo(
    () => (all ? filterCandidates(all, deferredFilter) : []),
    [all, deferredFilter],
  )
  const filtering = isFilterActive(deferredFilter)

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
        {all && <span className={styles.total}>전체 {all.length.toLocaleString('ko-KR')}명</span>}
        {all && all.length > 0 && (
          <FilterBar
            filter={filter}
            positions={positions}
            onChange={setFilter}
            matchCount={filtering ? visible.length : null}
          />
        )}
      </header>

      {candidates.isPending && <BoardSkeleton />}

      {candidates.isError && (
        <StateView
          title="지원자 목록을 불러오지 못했습니다"
          description={`${candidates.error.message} 잠시 후 다시 시도해 주세요.`}
          onRetry={() => void candidates.refetch()}
          retrying={candidates.isFetching}
        />
      )}

      {all &&
        (all.length === 0 ? (
          <StateView
            title="아직 지원자가 없습니다"
            description="새 지원자가 등록되면 이곳에 표시됩니다."
          />
        ) : visible.length === 0 ? (
          // "데이터가 없는 것"과 "찾는 결과가 없는 것"은 다르다. 후자는 조건을 바꾸면 해결된다.
          <StateView
            title="조건에 맞는 지원자가 없습니다"
            description="이름이나 직무 조건을 바꿔 보세요."
            onRetry={() => setFilter(EMPTY_FILTER)}
            retryLabel="필터 해제"
          />
        ) : (
          <Board
            candidates={visible}
            renderCard={(candidate) => (
              <Card key={candidate.id} candidate={candidate} onMove={handleMove} />
            )}
          />
        ))}

      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

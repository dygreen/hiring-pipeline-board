import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
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
import { useBoardKeyboard } from './features/board/useBoardKeyboard'
import { useUndo } from './features/board/useUndo'
import { BoardSkeleton } from './components/BoardSkeleton'
import { StateView } from './components/StateView'
import { DetailPanel } from './features/detail/DetailPanel'
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const candidates = useQuery({
    queryKey: candidatesKey,
    queryFn: ({ signal }) => fetchCandidates(signal),
  })

  const undo = useUndo()
  /*
   * 되돌리기와 이동은 서로를 필요로 한다.
   * 성공 토스트에는 "되돌리기" 버튼이 붙고, 되돌리기는 다시 이동을 실행한다.
   * 선언 순서로는 순환이라, 토스트는 ref를 거쳐 호출한다.
   */
  const undoRef = useRef<() => void>(() => {})

  const move = useMoveStage({
    onSuccess: ({ candidate, to, isUndo }) => {
      if (isUndo) {
        // 되돌리기를 다시 기록하면 Cmd+Z가 토글이 된다.
        push(`${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 되돌렸습니다.`)
        return
      }
      undo.remember(candidate, to)
      push(`${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 옮겼습니다.`, 'info', {
        label: '되돌리기',
        onClick: () => undoRef.current(),
      })
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

  const handleMove = useCallback(
    (candidate: Candidate, to: Stage) => {
      move.mutate({ candidate, to })
    },
    [move],
  )

  const handleSelect = useCallback((candidate: Candidate) => setSelectedId(candidate.id), [])

  const keyboard = useBoardKeyboard({
    onMove: handleMove,
    onSelect: handleSelect,
    // 막힌 방향을 눌렀을 때 아무 일도 일어나지 않으면 키가 안 먹는 건지 끝인 건지 알 수 없다.
    onBlocked: (message) => push(message),
  })

  const all = candidates.data
  // 직무 목록은 전체 기준으로 만든다. 걸러진 결과로 만들면 필터를 쓸수록 선택지가 사라진다.
  const positions = useMemo(() => (all ? collectPositions(all) : []), [all])
  const visible = useMemo(
    () => (all ? filterCandidates(all, deferredFilter) : []),
    [all, deferredFilter],
  )
  const filtering = isFilterActive(deferredFilter)

  /**
   * 되돌리기.
   *
   * `stageRules.canMove` 검사를 타지 않는다. 되돌리기는 새 이동이 아니라
   * 이미 있었던 상태로의 복원이라, 규칙으로 막으면 되돌릴 수 없는 이동이 생긴다
   * (면접 → 불합격을 되돌리면 규칙상 한 칸 건너뛰기가 된다).
   */
  const runUndo = useCallback(() => {
    const entry = undo.peek()
    if (!entry) {
      push('되돌릴 이동이 없습니다.')
      return
    }
    const current = all?.find((item) => item.id === entry.candidateId)
    const taken = undo.take(current)
    if (!taken || !current) {
      // 기억해둔 뒤에 그 카드가 또 움직였다. 되돌리면 의도하지 않은 곳으로 보내게 된다.
      push(`${entry.name}님의 카드가 그 사이 바뀌어 되돌릴 수 없습니다.`)
      return
    }
    move.mutate({ candidate: current, to: taken.from, isUndo: true })
  }, [all, move, push, undo])

  // 토스트의 "되돌리기" 버튼이 최신 함수를 부르도록 한다. 렌더 중에 ref를 건드리지 않는다.
  useEffect(() => {
    undoRef.current = runUndo
  }, [runUndo])

  // Cmd/Ctrl+Z. 입력창에서는 텍스트 실행 취소가 우선이라 가로채지 않는다.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, select, textarea')) return
      event.preventDefault()
      runUndo()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [runUndo])
  /*
   * 선택된 지원자는 id로 들고 캐시에서 다시 찾는다.
   * 객체를 그대로 담아두면 그 카드를 이동시켰을 때 패널은 옛 단계를 계속 보여준다.
   * 전체 목록(all)에서 찾는 이유는, 필터를 바꿔 목록에서 사라져도 열어둔 패널이 닫히지 않게 하기 위함이다.
   */
  const selected = selectedId ? (all?.find((c) => c.id === selectedId) ?? null) : null

  /*
   * 목록이 다시 그려진 뒤에 포커스를 이어준다.
   * 키보드로 카드를 옮기면 그 카드는 다른 컬럼에 다시 그려지고 원래 노드는 사라진다.
   * 이어주지 않으면 포커스가 body로 떨어져 카드 하나 옮길 때마다 처음부터 다시 찾아야 한다.
   */
  useEffect(() => {
    // 옮긴 카드가 어느 단계의 몇 번째인지는 목록을 가진 이쪽이 안다.
    keyboard.focusPending((id) => {
      const candidate = visible.find((item) => item.id === id)
      if (!candidate) return null
      const inColumn = visible.filter((item) => item.stage === candidate.stage)
      return { stage: candidate.stage, index: inColumn.indexOf(candidate) }
    })
  }, [visible, keyboard])

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

      {all && all.length > 0 && (
        <p className={styles.shortcuts}>
          <span>
            <kbd>Tab</kbd> 컬럼 이동
          </span>
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> 카드 이동
          </span>
          <span>
            <kbd>←</kbd> <kbd>→</kbd> 단계 옮기기
          </span>
          <span>
            <kbd>Enter</kbd> 상세
          </span>
          <span>
            <kbd>Delete</kbd> 불합격
          </span>
          <span>
            <kbd>⌘/Ctrl</kbd>+<kbd>Z</kbd> 되돌리기
          </span>
        </p>
      )}

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
            renderCard={(candidate, indexInColumn) => (
              <Card
                key={candidate.id}
                candidate={candidate}
                onMove={handleMove}
                onSelect={handleSelect}
                isTabStop={keyboard.isRovingTarget(candidate, indexInColumn)}
                onFocus={keyboard.handleFocus}
                onKeyDown={keyboard.handleKeyDown}
              />
            )}
          />
        ))}

      {selected && (
        <DetailPanel candidate={selected} onClose={() => setSelectedId(null)} onMove={handleMove} />
      )}

      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Board } from './features/board/Board'
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

  const candidates = useQuery({
    queryKey: candidatesKey,
    queryFn: ({ signal }) => fetchCandidates(signal),
  })

  const move = useMoveStage({
    onSuccess: ({ candidate, to }) => {
      push(`${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 옮겼습니다.`)
    },
    onError: ({ candidate, to }, message) => {
      // 실패했을 때 "무엇을 시도했고 지금 어디에 있는지"를 둘 다 알려준다.
      // "이동에 실패했습니다"만 띄우면 카드가 어디로 돌아갔는지 직접 찾아야 한다.
      push(
        `${candidate.name}님을 ${STAGE_LABEL[to]}(으)로 옮기지 못했습니다. ` +
          `${STAGE_LABEL[candidate.stage]}에 그대로 있습니다. (${message})`,
        'error',
      )
    },
  })

  const handleMove = (candidate: Candidate, to: Stage) => {
    move.mutate({ candidate, to })
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
        {candidates.data && <span className={styles.total}>전체 {candidates.data.length}명</span>}
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

      {candidates.data &&
        (candidates.data.length === 0 ? (
          <StateView
            title="아직 지원자가 없습니다"
            description="새 지원자가 등록되면 이곳에 표시됩니다."
          />
        ) : (
          <Board
            candidates={candidates.data}
            renderCard={(candidate) => (
              <Card key={candidate.id} candidate={candidate} onMove={handleMove} />
            )}
          />
        ))}

      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

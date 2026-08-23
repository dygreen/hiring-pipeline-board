import { useEffect, useState } from 'react'
import { Board } from './features/board/Board'
import { Card } from './features/board/Card'
import { BoardSkeleton } from './components/BoardSkeleton'
import { StateView } from './components/StateView'
import type { Candidate, Stage } from './types/candidate'
import styles from './App.module.css'

/**
 * 세 상태를 하나의 유니온으로 둔다.
 * `isLoading`/`error`/`data`를 각각 두면 "로딩 중인데 에러도 있는" 조합이 표현 가능해지고,
 * 화면에서 그 조합을 어떻게 그릴지 매번 판단해야 한다.
 */
type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; candidates: Candidate[] }

async function moveStage(id: string, stage: Stage): Promise<Candidate> {
  const response = await fetch(`/api/candidates/${id}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `이동에 실패했습니다 (${response.status})`)
  }
  return (await response.json()) as Candidate
}

async function fetchCandidates(signal: AbortSignal): Promise<Candidate[]> {
  const response = await fetch('/api/candidates', { signal })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `요청이 실패했습니다 (${response.status})`)
  }
  return (await response.json()) as Candidate[]
}

export default function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  /** 값 자체는 의미가 없고, 바뀌면 재조회가 걸린다. */
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    /*
     * 재시도를 연달아 누르면 요청이 겹친다. mock API 지연이 200~800ms로 들쭉날쭉해서
     * 먼저 보낸 요청이 나중에 도착할 수 있고, 그러면 오래된 목록이 최신 목록을 덮어쓴다.
     * 이전 요청을 취소하고, 취소가 늦더라도 응답 반영을 막는다.
     */
    const controller = new AbortController()

    fetchCandidates(controller.signal)
      .then((candidates) => {
        if (!controller.signal.aborted) setState({ status: 'ready', candidates })
      })
      .catch((cause: Error) => {
        // 취소는 실패가 아니다. 에러 화면을 띄우면 안 된다.
        if (controller.signal.aborted) return
        setState({ status: 'error', message: cause.message })
      })

    return () => controller.abort()
  }, [reloadKey])

  const retry = () => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }

  /** 이동 요청이 진행 중인 카드 id. 커밋 7에서 낙관적 업데이트로 대체된다. */
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)

  const handleMove = async (candidate: Candidate, to: Stage) => {
    setPendingId(candidate.id)
    setMoveError(null)
    try {
      const updated = await moveStage(candidate.id, to)
      // 지금은 서버 응답을 받은 뒤에야 화면이 바뀐다. 200~800ms 동안 카드가 그대로 있다.
      // 이 체감 지연을 없애는 것이 다음 커밋의 낙관적 업데이트다.
      setState((current) =>
        current.status === 'ready'
          ? {
              ...current,
              candidates: current.candidates.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      )
    } catch (cause) {
      setMoveError(`${(cause as Error).message} ${candidate.name}님은 그대로 있습니다.`)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
        {/* 이동 실패 안내. 커밋 7에서 토스트로 바뀐다. */}
        {moveError && (
          <p className={styles.moveError} role="alert">
            {moveError}
          </p>
        )}

        {state.status === 'ready' && (
          <span className={styles.total}>전체 {state.candidates.length}명</span>
        )}
      </header>

      {state.status === 'loading' && <BoardSkeleton />}

      {state.status === 'error' && (
        <StateView
          title="지원자 목록을 불러오지 못했습니다"
          description={`${state.message} 잠시 후 다시 시도해 주세요.`}
          onRetry={retry}
        />
      )}

      {/* 이동 실패 안내. 커밋 7에서 토스트로 바뀐다. */}
      {moveError && (
        <p className={styles.moveError} role="alert">
          {moveError}
        </p>
      )}

      {state.status === 'ready' &&
        (state.candidates.length === 0 ? (
          <StateView
            title="아직 지원자가 없습니다"
            description="새 지원자가 등록되면 이곳에 표시됩니다."
          />
        ) : (
          <Board
            candidates={state.candidates}
            renderCard={(candidate) => (
              <Card
                key={candidate.id}
                candidate={candidate}
                onMove={handleMove}
                pending={pendingId === candidate.id}
              />
            )}
          />
        ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Board } from './features/board/Board'
import type { Candidate } from './types/candidate'
import styles from './App.module.css'

export default function App() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 데이터 계층은 커밋 7에서 TanStack Query로 옮긴다. 지금은 레이아웃 확인이 목적이다.
  useEffect(() => {
    fetch('/api/candidates')
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status))
        setCandidates((await response.json()) as Candidate[])
      })
      .catch((cause: Error) => setError(cause.message))
  }, [])

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1>채용 파이프라인 보드</h1>
        {candidates && <span className={styles.total}>전체 {candidates.length}명</span>}
      </header>

      {error && <p>불러오지 못했습니다 ({error})</p>}
      {!candidates && !error && <p>불러오는 중…</p>}

      {candidates && (
        <Board
          candidates={candidates}
          renderCard={(candidate) => (
            // 커밋 4에서 Card 컴포넌트로 대체된다.
            <div key={candidate.id} className={styles.cardPlaceholder}>
              {candidate.name}
            </div>
          )}
        />
      )}
    </div>
  )
}

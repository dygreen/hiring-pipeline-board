import { useEffect, useState } from 'react'
import { STAGE_LABEL, STAGES, type Candidate } from './types/candidate'

/**
 * 임시 화면. mock API가 실제로 응답하는지 눈으로 확인하기 위한 것이며,
 * 보드 레이아웃(다음 커밋)이 들어오면 대체된다.
 */
export default function App() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/candidates')
      .then(async (response) => {
        if (!response.ok) throw new Error(`${response.status}`)
        setCandidates((await response.json()) as Candidate[])
      })
      .catch((cause: Error) => setError(cause.message))
  }, [])

  if (error) return <div className="app">불러오지 못했습니다 ({error})</div>
  if (!candidates) return <div className="app">불러오는 중…</div>

  return (
    <div className="app">
      <h1>채용 파이프라인 보드</h1>
      <p>총 {candidates.length}건</p>
      <ul>
        {STAGES.map((stage) => (
          <li key={stage}>
            {STAGE_LABEL[stage]}: {candidates.filter((c) => c.stage === stage).length}건
          </li>
        ))}
      </ul>
    </div>
  )
}

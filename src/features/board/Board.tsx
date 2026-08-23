import { STAGES, type Candidate } from '../../types/candidate'
import { StateView } from '../../components/StateView'
import { Column } from './Column'
import styles from './Board.module.css'

interface BoardProps {
  candidates: Candidate[]
  /** `indexInColumn`은 roving tabindex 대상을 정하는 데 쓰인다. */
  renderCard: (candidate: Candidate, indexInColumn: number) => React.ReactNode
}

/**
 * 단계별로 카드를 나눈다.
 *
 * STAGES를 돌면서 filter를 다섯 번 하면 1,000건 × 5회를 훑게 된다.
 * 한 번만 순회해 단계별 배열로 나눈다.
 */
function groupByStage(candidates: Candidate[]): Record<string, Candidate[]> {
  const grouped: Record<string, Candidate[]> = {}
  for (const stage of STAGES) grouped[stage] = []
  for (const candidate of candidates) grouped[candidate.stage]?.push(candidate)
  return grouped
}

export function Board({ candidates, renderCard }: BoardProps) {
  const grouped = groupByStage(candidates)

  return (
    <div className={styles.board}>
      {STAGES.map((stage) => (
        <Column key={stage} stage={stage} count={grouped[stage].length}>
          {grouped[stage].length === 0 ? (
            <StateView compact title="지원자가 없습니다" />
          ) : (
            grouped[stage].map(renderCard)
          )}
        </Column>
      ))}
    </div>
  )
}

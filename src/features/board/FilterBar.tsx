import { useId } from 'react'
import type { BoardFilter } from './filterCandidates'
import styles from './FilterBar.module.css'

interface FilterBarProps {
  filter: BoardFilter
  positions: string[]
  onChange: (filter: BoardFilter) => void
  /** 필터를 적용한 결과 건수. 필터가 없으면 null. */
  matchCount: number | null
}

export function FilterBar({ filter, positions, onChange, matchCount }: FilterBarProps) {
  const queryId = useId()
  const positionId = useId()
  const active = filter.query !== '' || filter.position !== ''

  return (
    <div className={styles.bar}>
      <div className={styles.field}>
        <label htmlFor={queryId} className="sr-only">
          지원자 이름 검색
        </label>
        <input
          id={queryId}
          className={styles.input}
          type="search"
          placeholder="이름 검색"
          value={filter.query}
          onChange={(event) => onChange({ ...filter, query: event.target.value })}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor={positionId} className="sr-only">
          직무 필터
        </label>
        <select
          id={positionId}
          className={styles.select}
          value={filter.position}
          onChange={(event) => onChange({ ...filter, position: event.target.value })}
        >
          <option value="">전체 직무</option>
          {positions.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => onChange({ query: '', position: '' })}
        >
          필터 해제
        </button>
      )}

      {/*
       * 검색 결과 건수를 aria-live로 알린다.
       * 시각적으로는 목록이 줄어드는 것이 바로 보이지만, 스크린리더 사용자에게는
       * 입력한 뒤 결과가 몇 건인지 알 방법이 없다. 목록을 직접 훑어야 한다.
       */}
      <span className={styles.result} role="status" aria-live="polite">
        {matchCount === null ? '' : `${matchCount.toLocaleString('ko-KR')}명`}
      </span>
    </div>
  )
}

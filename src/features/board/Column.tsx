import type { ReactNode } from 'react'
import { STAGE_LABEL, type Stage } from '../../types/candidate'
import styles from './Board.module.css'

interface ColumnProps {
  stage: Stage
  count: number
  children: ReactNode
  /** 로딩 중이면 개수를 감춘다. 아직 모르는 값을 0으로 보여주면 "0건"이라는 오정보가 된다. */
  loading?: boolean
}

export function Column({ stage, count, children, loading = false }: ColumnProps) {
  const label = STAGE_LABEL[stage]

  return (
    /*
     * region + aria-label을 주면 스크린리더 사용자가 랜드마크 목록에서
     * 단계를 골라 바로 이동할 수 있다. 컬럼이 5개라 순차 탐색은 비용이 크다.
     */
    <section className={styles.column} aria-labelledby={`column-${stage}`}>
      <header className={styles.columnHeader}>
        <h2 className={styles.columnTitle} id={`column-${stage}`}>
          {label}
        </h2>
        {/*
         * 숫자만 읽어주면 무엇의 개수인지 알 수 없어서 aria-label로 보충한다.
         * 화면에는 "12"만 보이고 스크린리더는 "면접 12건"으로 읽는다.
         */}
        {!loading && (
          <span className={styles.columnCount} aria-label={`${label} ${count}건`}>
            {count}
          </span>
        )}
      </header>
      {/* 본문은 호출부가 넘긴다. 가상 스크롤은 자체 스크롤 컨테이너를 갖기 때문이다. */}
      {children}
    </section>
  )
}

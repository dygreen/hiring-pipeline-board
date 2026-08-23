import { STAGE_LABEL, type Candidate, type Stage } from '../../types/candidate'
import { formatAppliedDateFull, formatAppliedDateShort } from '../../lib/date'
import { REJECTED, canReject, nextStage, previousStage } from './stageRules'
import styles from './Card.module.css'

interface CardProps {
  candidate: Candidate
  onMove: (candidate: Candidate, to: Stage) => void
  /** 이 카드의 이동 요청이 진행 중인가. */
  pending?: boolean
}

export function Card({ candidate, onMove, pending = false }: CardProps) {
  const { name, position, appliedAt, stage } = candidate

  const previous = previousStage(stage)
  const next = nextStage(stage)
  const rejectable = canReject(stage)

  return (
    /*
     * article에 이름을 붙이지 않으면 스크린리더의 요소 단위 탐색에서
     * 이름 없는 article이 수백 개 반복된다. 안으로 들어가 본문을 읽어야만 누구인지 알 수 있다.
     * aria-label로 카드의 이름을 지어주면 목록을 훑는 것만으로 대상을 찾을 수 있다.
     */
    <article className={styles.card} aria-label={`${name} · ${position}`} data-pending={pending}>
      <span className={styles.name} title={name}>
        {name}
      </span>
      <div className={styles.meta}>
        <span className={styles.position} title={position}>
          {position}
        </span>
        {/*
         * time 요소로 감싸면 기계가 읽을 수 있는 날짜가 dateTime에 남는다.
         * 화면에는 "8월 1일", 읽어줄 때는 "2026년 8월 1일 지원".
         */}
        <time className={styles.appliedAt} dateTime={appliedAt}>
          <span aria-hidden="true">{formatAppliedDateShort(appliedAt)}</span>
          <span className="sr-only">{formatAppliedDateFull(appliedAt)} 지원</span>
        </time>
      </div>
      {/*
       * 현재 단계는 컬럼 위치로 이미 드러나므로 화면에 또 적지 않는다.
       * 다만 카드만 따로 읽는 스크린리더 사용자에게는 그 맥락이 없어서 텍스트로 남긴다.
       */}
      <span className="sr-only">현재 단계 {STAGE_LABEL[stage]}</span>

      <div className={styles.actions}>
        {/*
         * 버튼 이름에 대상 단계를 넣는다. "이전"만으로는 어디로 가는지 알 수 없고,
         * 카드가 수백 개라 스크린리더에서 같은 이름의 버튼이 끝없이 반복된다.
         */}
        <button
          type="button"
          className={styles.action}
          disabled={!previous || pending}
          onClick={() => previous && onMove(candidate, previous)}
          aria-label={previous ? `${name}을(를) ${STAGE_LABEL[previous]}(으)로 이동` : undefined}
        >
          ← {previous ? STAGE_LABEL[previous] : '이전'}
        </button>
        <button
          type="button"
          className={styles.action}
          disabled={!next || pending}
          onClick={() => next && onMove(candidate, next)}
          aria-label={next ? `${name}을(를) ${STAGE_LABEL[next]}(으)로 이동` : undefined}
        >
          {next ? STAGE_LABEL[next] : '다음'} →
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.reject}`}
          disabled={!rejectable || pending}
          onClick={() => onMove(candidate, REJECTED)}
          aria-label={`${name}을(를) 불합격으로 이동`}
        >
          불합격
        </button>
      </div>
    </article>
  )
}

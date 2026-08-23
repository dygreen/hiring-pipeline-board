import { useCallback, useId, useRef } from 'react'
import { STAGE_LABEL, type Candidate, type Stage } from '../../types/candidate'
import { formatAppliedDateFull } from '../../lib/date'
import { useFocusTrap } from '../../lib/useFocusTrap'
import { REJECTED, canReject, nextStage, previousStage } from '../board/stageRules'
import styles from './DetailPanel.module.css'

interface DetailPanelProps {
  candidate: Candidate
  onClose: () => void
  onMove: (candidate: Candidate, to: Stage) => void
}

function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function DetailPanel({ candidate, onClose, onMove }: DetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  // onClose가 매 렌더 새 함수면 포커스 트랩이 계속 재설정되고, 그때마다 포커스가 패널로 되돌아간다.
  const handleEscape = useCallback(() => onClose(), [onClose])

  /*
   * 패널에서 이동시키면 카드가 다른 컬럼에 다시 그려지면서 원래 버튼이 사라진다.
   * 같은 지원자의 새 카드를 찾아 그쪽으로 포커스를 옮긴다.
   */
  const candidateId = candidate.id
  const resolveFallback = useCallback(
    () => document.querySelector<HTMLElement>(`[data-id="${candidateId}"] button`),
    [candidateId],
  )

  useFocusTrap(panelRef, true, handleEscape, resolveFallback)

  const previous = previousStage(candidate.stage)
  const next = nextStage(candidate.stage)

  return (
    <>
      {/*
       * 배경은 클릭으로 닫기 위한 것이고 읽을 내용이 없다.
       * 키보드 사용자는 Esc로 닫으므로 배경에 포커스를 줄 이유도 없다.
       */}
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 className={styles.title} id={titleId}>
              {candidate.name}
            </h2>
            <p className={styles.subtitle}>{candidate.position}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            닫기
          </button>
        </header>

        <div className={styles.body}>
          <dl className={styles.list}>
            <dt>현재 단계</dt>
            <dd>
              <span className={styles.stageBadge}>{STAGE_LABEL[candidate.stage]}</span>
            </dd>

            <dt>지원일</dt>
            <dd>
              <time dateTime={candidate.appliedAt}>
                {formatAppliedDateFull(candidate.appliedAt)}
              </time>
            </dd>

            <dt>경력</dt>
            <dd>{candidate.experienceYears === 0 ? '신입' : `${candidate.experienceYears}년`}</dd>

            <dt>이메일</dt>
            <dd>
              <a href={`mailto:${candidate.email}`}>{candidate.email}</a>
            </dd>

            <dt>연락처</dt>
            <dd>
              <a href={`tel:${candidate.phone.replace(/-/g, '')}`}>{candidate.phone}</a>
            </dd>

            <dt>마지막 변경</dt>
            <dd>
              <time dateTime={candidate.updatedAt}>{formatUpdatedAt(candidate.updatedAt)}</time>
            </dd>
          </dl>
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerLabel}>단계 이동</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.action}
              disabled={!previous}
              onClick={() => previous && onMove(candidate, previous)}
            >
              ← {previous ? STAGE_LABEL[previous] : '이전'}
            </button>
            <button
              type="button"
              className={styles.action}
              disabled={!next}
              onClick={() => next && onMove(candidate, next)}
            >
              {next ? STAGE_LABEL[next] : '다음'} →
            </button>
            <button
              type="button"
              className={`${styles.action} ${styles.reject}`}
              disabled={!canReject(candidate.stage)}
              onClick={() => onMove(candidate, REJECTED)}
            >
              불합격
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}

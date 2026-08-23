import styles from './StateView.module.css'

interface StateViewProps {
  title: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
  /** 컬럼 내부처럼 좁은 자리에 쓸 때 여백을 줄인다. */
  compact?: boolean
}

export function StateView({
  title,
  description,
  onRetry,
  retryLabel = '다시 시도',
  retrying = false,
  compact = false,
}: StateViewProps) {
  return (
    <div className={compact ? `${styles.stateView} ${styles.inColumn}` : styles.stateView}>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry} disabled={retrying}>
          {retrying ? '불러오는 중…' : retryLabel}
        </button>
      )}
    </div>
  )
}

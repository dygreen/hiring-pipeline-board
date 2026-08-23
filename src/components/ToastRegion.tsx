import type { Toast } from './useToasts'
import styles from './Toast.module.css'

interface ToastRegionProps {
  toasts: Toast[]
  onDismiss: (id: number) => void
}

export function ToastRegion({ toasts, onDismiss }: ToastRegionProps) {
  return (
    /*
     * 성공과 실패를 한 영역에 섞지 않는다.
     * role="alert"는 스크린리더가 읽던 것을 끊고 즉시 알리고,
     * role="status"는 하던 말을 마친 뒤 알린다.
     * 이동 성공은 끼어들 만한 일이 아니고, 실패는 끼어들어야 하는 일이다.
     */
    <div className={styles.region}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={toast.tone === 'error' ? `${styles.toast} ${styles.error}` : styles.toast}
          role={toast.tone === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                toast.action?.onClick()
                onDismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className={styles.dismiss} onClick={() => onDismiss(toast.id)}>
            닫기
          </button>
        </div>
      ))}
    </div>
  )
}

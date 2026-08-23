import { useCallback, useRef, useState } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
  /** 토스트에서 바로 실행할 동작(되돌리기 등). */
  action?: ToastAction
}

const AUTO_DISMISS_MS = 5_000

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  /** 타이머를 들고 있어야 언마운트나 수동 닫기에서 정리할 수 있다. */
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((list) => list.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: Toast['tone'] = 'info', action?: ToastAction) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, tone, action }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
      return id
    },
    [dismiss],
  )

  return { toasts, push, dismiss }
}

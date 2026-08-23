import { useCallback, useRef, useState } from 'react'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
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
    (message: string, tone: Toast['tone'] = 'info') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, tone }])
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

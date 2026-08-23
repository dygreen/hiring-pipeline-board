import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 열려 있는 동안 포커스를 컨테이너 안에 가둔다.
 *
 * 가두지 않으면 Tab을 누르는 순간 포커스가 뒤에 있는 보드로 넘어간다.
 * 화면에는 패널이 덮여 있는데 키보드는 그 아래를 조작하게 되고,
 * 스크린리더 사용자는 자기가 어디에 있는지 알 수 없게 된다.
 *
 * 닫을 때는 열기 전에 포커스가 있던 곳으로 되돌린다.
 * 되돌리지 않으면 포커스가 문서 처음으로 떨어져서, 카드 하나를 열어봤다가 닫을 때마다
 * 보고 있던 위치를 잃는다.
 *
 * `resolveFallback`은 원래 위치가 사라졌을 때 대신 포커스할 곳을 찾는다.
 * 패널에서 카드를 이동시키면 그 카드는 다른 컬럼에 다시 그려지고, 원래 버튼은 언마운트된다.
 * 그대로 두면 포커스가 body로 떨어져 보고 있던 자리를 잃는다.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape: () => void,
  resolveFallback?: () => HTMLElement | null,
) {
  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    // 패널 자체에 먼저 포커스를 준다. 첫 요소로 바로 보내면
    // 스크린리더가 패널 제목을 읽지 못하고 그 요소부터 읽는다.
    container.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onEscape()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement

      if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && current === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
        return
      }
      // 원래 위치가 사라졌다면 대체 위치를 찾는다.
      // 패널을 닫는 렌더가 끝난 뒤에 찾아야 새로 그려진 요소를 잡을 수 있다.
      requestAnimationFrame(() => resolveFallback?.()?.focus())
    }
  }, [containerRef, active, onEscape, resolveFallback])
}

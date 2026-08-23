import { useCallback, useRef } from 'react'
import type { Candidate, Stage } from '../../types/candidate'
import { REJECTED, canReject, nextStage, previousStage } from './stageRules'

/**
 * 보드 전체의 키보드 조작.
 *
 * ## 왜 카드마다 Tab으로 도는 방식이 아닌가
 *
 * 카드 하나에 포커스 가능한 요소가 4개(상세 열기 + 이동 버튼 3개)다.
 * 1,000건이면 **Tab을 4,000번** 눌러야 마지막 카드에 닿는다. 사실상 도달 불가다.
 *
 * 그래서 목록 위젯의 관례를 따른다. 컬럼 안에서 **포커스를 받는 카드는 항상 하나**이고
 * (roving tabindex), 나머지는 Tab 순서에서 빠진다. 카드 사이 이동은 방향키로 한다.
 * Tab은 "컬럼 사이"를 넘나드는 큰 단위 이동이 된다.
 *
 * ## 키 배치
 *
 * - `↑` `↓`  같은 컬럼 안에서 카드 이동
 * - `←` `→`  **단계 이동**(카드를 옮긴다)
 * - `Home` `End`  컬럼의 처음·끝 카드
 * - `Enter` `Space`  상세 열기
 * - `Delete` `Backspace`  불합격 처리
 *
 * `←` `→`를 포커스 이동이 아니라 단계 이동에 배정한 이유:
 * 이 화면에서 사용자가 반복하는 일은 "카드를 옮기는 것"이지 "컬럼을 구경하는 것"이 아니다.
 * 컬럼 간 이동은 Tab으로 이미 가능하다.
 *
 * ## 이동 후 포커스를 따라가게 한다
 *
 * 카드를 옮기면 그 카드는 다른 컬럼에 다시 그려지고 원래 DOM 노드는 언마운트된다.
 * 그대로 두면 포커스가 `body`로 떨어져서, **카드 하나를 옮길 때마다 처음부터 다시 찾아야 한다.**
 * 옮긴 카드를 새 위치에서 찾아 포커스를 이어준다.
 */

interface BoardKeyboardOptions {
  onMove: (candidate: Candidate, to: Stage) => void
  onSelect: (candidate: Candidate) => void
  /** 이동이 불가능한 방향을 눌렀을 때 알린다. */
  onBlocked: (message: string) => void
}

/** 같은 컬럼 안에서 다음/이전 카드로 포커스를 옮긴다. */
function focusSibling(current: HTMLElement, direction: 1 | -1 | 'first' | 'last') {
  const column = current.closest('section')
  if (!column) return
  const cards = [...column.querySelectorAll<HTMLElement>('article[data-id]')]
  const index = cards.indexOf(current)
  if (index === -1) return

  const target =
    direction === 'first'
      ? cards[0]
      : direction === 'last'
        ? cards[cards.length - 1]
        : cards[index + direction]

  target?.focus()
}

export function useBoardKeyboard({ onMove, onSelect, onBlocked }: BoardKeyboardOptions) {
  /**
   * 컬럼별로 마지막에 포커스했던 카드 id.
   * Tab으로 컬럼을 떠났다 돌아왔을 때 맨 위로 튕기지 않게 한다.
   */
  const lastFocusedByColumn = useRef(new Map<Stage, string>())
  /**
   * 이동시킨 뒤 포커스를 되찾아야 할 카드.
   *
   * `requestAnimationFrame`으로는 안 된다. 낙관적 반영이 React의 렌더 커밋 뒤에 일어나서,
   * 다음 프레임에 찾으면 아직 옛 위치의 노드를 잡거나 이미 사라진 노드를 잡는다.
   * 목록이 실제로 다시 그려진 뒤(`focusPending` 호출 시점)에 찾아야 한다.
   */
  const pendingFocusId = useRef<string | null>(null)

  /** 목록이 다시 그려진 뒤에 호출한다. 옮긴 카드가 새 위치에 있으면 포커스를 이어준다. */
  const focusPending = useCallback(() => {
    const id = pendingFocusId.current
    if (!id) return
    const element = document.querySelector<HTMLElement>(`article[data-id="${id}"]`)
    if (!element) return
    pendingFocusId.current = null
    element.focus()
  }, [])

  const isRovingTarget = useCallback((candidate: Candidate, indexInColumn: number) => {
    const remembered = lastFocusedByColumn.current.get(candidate.stage)
    // 기억된 카드가 있으면 그 카드가, 없으면 첫 카드가 Tab 대상이 된다.
    return remembered ? remembered === candidate.id : indexInColumn === 0
  }, [])

  const handleFocus = useCallback((candidate: Candidate) => {
    lastFocusedByColumn.current.set(candidate.stage, candidate.id)
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>, candidate: Candidate) => {
      // 카드 안의 버튼에서 올라온 키 이벤트는 그 버튼이 처리하게 둔다.
      if (event.target !== event.currentTarget) return

      const element = event.currentTarget

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          focusSibling(element, 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          focusSibling(element, -1)
          break
        case 'Home':
          event.preventDefault()
          focusSibling(element, 'first')
          break
        case 'End':
          event.preventDefault()
          focusSibling(element, 'last')
          break
        case 'ArrowRight': {
          event.preventDefault()
          const next = nextStage(candidate.stage)
          if (next) {
            pendingFocusId.current = candidate.id
            onMove(candidate, next)
          } else onBlocked(`${candidate.name}님은 더 진행할 단계가 없습니다.`)
          break
        }
        case 'ArrowLeft': {
          event.preventDefault()
          const previous = previousStage(candidate.stage)
          if (previous) {
            pendingFocusId.current = candidate.id
            onMove(candidate, previous)
          } else onBlocked(`${candidate.name}님은 이전 단계가 없습니다.`)
          break
        }
        case 'Delete':
        case 'Backspace':
          event.preventDefault()
          if (canReject(candidate.stage)) {
            pendingFocusId.current = candidate.id
            onMove(candidate, REJECTED)
          } else onBlocked(`${candidate.name}님은 이미 불합격 처리되었습니다.`)
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          onSelect(candidate)
          break
        default:
          break
      }
    },
    [onMove, onSelect, onBlocked],
  )

  return { isRovingTarget, handleFocus, handleKeyDown, focusPending }
}

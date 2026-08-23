import { useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Candidate } from '../../types/candidate'
import styles from './Board.module.css'

/** 카드 높이(108px) + 카드 사이 간격(8px). Card.module.css와 맞물려 있다. */
const ROW_HEIGHT = 116

/**
 * 컬럼 목록을 화면에 보이는 만큼만 그린다.
 *
 * ## 왜 필요한가
 *
 * 1,000건이면 서류검토 컬럼 하나에만 카드가 457장이다.
 * 전부 DOM에 올리면 문서 전체 노드가 1,000개를 넘고, 필터를 지울 때마다
 * 그 전부를 다시 마운트하느라 메인 스레드가 멈춘다(커밋 11에서 156ms 측정).
 *
 * ## 키보드 조작과의 충돌
 *
 * 커밋 13의 방향키 이동은 `column.querySelectorAll('article')`로 형제 카드를 찾는다.
 * 가상 스크롤을 켜면 **화면 밖 카드는 DOM에 없어서** 그 목록이 잘린다.
 * 그래서 `↑↓`로 화면 경계를 넘어가려 할 때, 먼저 그 위치로 스크롤해 카드를 그린 뒤
 * 포커스를 옮겨야 한다. 이 조정은 `onNeedRow`로 부모(useBoardKeyboard)에 알린다.
 *
 * `overscan`을 넉넉히 둔 것도 같은 이유다. 화면 바로 밖의 카드가 미리 그려져 있으면
 * 한 칸 이동에서 스크롤을 기다릴 필요가 없다.
 */
interface VirtualCardListProps {
  candidates: Candidate[]
  renderCard: (candidate: Candidate, indexInColumn: number) => ReactNode
  stage: string
}

export function VirtualCardList({ candidates, renderCard, stage }: VirtualCardListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: candidates.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    getItemKey: (index) => candidates[index].id,
  })

  return (
    // data-count / data-row-height는 키보드 이동이 화면 밖 카드로 갈 때 쓰인다.
    // 전체 개수를 모르면 End가 "DOM에 있는 마지막 카드"로 가버린다.
    <div
      ref={scrollRef}
      className={styles.virtualBody}
      data-virtual="true"
      data-count={candidates.length}
      data-row-height={ROW_HEIGHT}
      data-stage={stage}
    >
      {/*
       * 전체 높이만큼 자리를 잡아둔다. 이게 없으면 스크롤바가 보이는 카드 수만큼만 생겨서
       * 목록이 실제보다 짧아 보이고, 스크롤 위치도 튄다.
       */}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${row.start}px)`,
            }}
          >
            {renderCard(candidates[row.index], row.index)}
          </div>
        ))}
      </div>
    </div>
  )
}

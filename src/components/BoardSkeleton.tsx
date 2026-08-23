import { STAGES } from '../types/candidate'
import { Column } from '../features/board/Column'
import boardStyles from '../features/board/Board.module.css'
import styles from './Skeleton.module.css'

const SKELETON_CARDS_PER_COLUMN = 6

/**
 * 로딩 중에도 컬럼 골격을 그대로 보여준다.
 *
 * 가운데에 스피너 하나만 띄우면 로딩이 끝나는 순간 화면 구조가 통째로 바뀌어 시선이 흔들린다.
 * 최종 화면과 같은 자리에 같은 크기의 자리를 미리 잡아두면 전환이 조용하다.
 */
export function BoardSkeleton() {
  return (
    <div className={boardStyles.board} aria-busy="true">
      {/* 골격 카드는 읽을 내용이 없다. 상태만 한 번 알리고 나머지는 감춘다. */}
      <span className="sr-only">지원자 목록을 불러오는 중입니다.</span>
      {STAGES.map((stage) => (
        <Column key={stage} stage={stage} count={0} loading>
          {Array.from({ length: SKELETON_CARDS_PER_COLUMN }, (_, index) => (
            <div key={index} className={styles.skeletonCard} aria-hidden="true" />
          ))}
        </Column>
      ))}
    </div>
  )
}

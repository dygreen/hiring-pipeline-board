import type { Stage } from '../../types/candidate'

/**
 * 같은 카드의 이동 요청을 직렬화하고, 되돌릴 기준점을 관리한다.
 *
 * React에 의존하지 않는 순수 모듈로 둔 이유는 테스트 때문이다.
 * 경쟁 상태는 화면을 띄워서 재현하기 어렵다 — 지연이 랜덤이고, 원하는 순서를 만들려면
 * 요청마다 응답 시각을 통제해야 한다. 이 로직만 떼어놓으면 순서를 직접 지정해 검증할 수 있다.
 */

/** 요청 하나의 결과. */
export type MoveOutcome = 'applied' | 'stale'

export interface MoveTicket {
  /** 이 카드에서 몇 번째 요청인가. */
  seq: number
  /** 실패 시 되돌릴 단계. 서버가 마지막으로 확정한 값이다. */
  rollbackTo: Stage
}

export interface MoveCoordinator {
  /** 요청 시작을 알리고 표를 받는다. */
  begin(id: string, currentStage: Stage): MoveTicket
  /** 이 표가 아직 최신인가. 아니면 응답을 버려야 한다. */
  isLatest(id: string, ticket: MoveTicket): boolean
  /** 서버가 확정한 단계를 기록하고 요청을 닫는다. */
  settleSuccess(id: string, ticket: MoveTicket, stage: Stage): MoveOutcome
  /** 실패를 기록하고 요청을 닫는다. */
  settleFailure(id: string, ticket: MoveTicket): MoveOutcome
  /** 같은 카드의 작업을 앞선 작업 뒤에 줄 세운다. 다른 카드끼리는 서로 기다리지 않는다. */
  enqueue<T>(id: string, task: () => Promise<T>): Promise<T>
  /** 검사용. 진행 중인 카드 수. */
  pendingCards(): number
}

export function createMoveCoordinator(): MoveCoordinator {
  /** 카드별 발행 순번. */
  const seqByCard = new Map<string, number>()
  /** 카드별 진행 중인 요청 수. */
  const inflightByCard = new Map<string, number>()
  /**
   * 카드별로 서버가 마지막에 확정한 단계.
   *
   * 낙관적 단계를 되돌림 기준으로 쓰면 안 된다. 요청이 겹친 상태에서
   * 두 요청이 모두 실패하면, 두 번째의 "직전 단계"는 첫 번째가 만든 낙관 값이라
   * 서버에 한 번도 저장된 적 없는 단계로 되돌아간다.
   */
  const confirmedByCard = new Map<string, Stage>()
  /** 카드별 직렬 실행 꼬리. */
  const tailByCard = new Map<string, Promise<unknown>>()

  return {
    begin(id, currentStage) {
      const inflight = inflightByCard.get(id) ?? 0
      // 진행 중인 요청이 없을 때의 화면 값만 서버 확정 상태로 신뢰할 수 있다.
      if (inflight === 0) confirmedByCard.set(id, currentStage)
      inflightByCard.set(id, inflight + 1)

      const seq = (seqByCard.get(id) ?? 0) + 1
      seqByCard.set(id, seq)

      return { seq, rollbackTo: confirmedByCard.get(id) ?? currentStage }
    },

    isLatest(id, ticket) {
      return seqByCard.get(id) === ticket.seq
    },

    settleSuccess(id, ticket, stage) {
      // 지나간 요청이라도 서버가 확정한 값이므로 기준점은 갱신한다.
      // 다만 화면 반영은 최신 요청일 때만 한다.
      confirmedByCard.set(id, stage)
      const latest = seqByCard.get(id) === ticket.seq
      close(id)
      return latest ? 'applied' : 'stale'
    },

    settleFailure(id, ticket) {
      const latest = seqByCard.get(id) === ticket.seq
      close(id)
      return latest ? 'applied' : 'stale'
    },

    enqueue(id, task) {
      const previous = tailByCard.get(id)
      // 앞선 요청이 실패해도 다음 요청은 실행한다. 사용자가 이미 누른 조작이다.
      const run = previous ? previous.then(task, task) : task()
      const tail = run.then(
        () => undefined,
        () => undefined,
      )
      tailByCard.set(id, tail)
      void tail.then(() => {
        // 내가 마지막 꼬리일 때만 지운다. 그 사이 새 요청이 붙었으면 그쪽이 꼬리다.
        if (tailByCard.get(id) === tail) tailByCard.delete(id)
      })
      return run
    },

    pendingCards() {
      return inflightByCard.size
    },
  }

  function close(id: string) {
    const remaining = (inflightByCard.get(id) ?? 1) - 1
    if (remaining <= 0) {
      inflightByCard.delete(id)
      seqByCard.delete(id)
      confirmedByCard.delete(id)
    } else {
      inflightByCard.set(id, remaining)
    }
  }
}

import type { Candidate } from '../../types/candidate'

export interface BoardFilter {
  /** 이름 검색어. 공백은 무시한다. */
  query: string
  /** 선택된 직무. 빈 문자열이면 전체. */
  position: string
}

export const EMPTY_FILTER: BoardFilter = { query: '', position: '' }

export function isFilterActive(filter: BoardFilter): boolean {
  return filter.query.trim() !== '' || filter.position !== ''
}

/**
 * 이름 검색어를 비교 가능한 형태로 다듬는다.
 *
 * - 공백 제거: "홍 길동"으로 쳐도 "홍길동"을 찾게 한다.
 * - NFC 정규화: macOS에서 한글을 입력하거나 붙여넣으면 자모가 분리된 NFD로 들어오는 경우가 있다.
 *   눈으로는 같은 "홍길동"인데 코드포인트가 달라 검색이 안 된다.
 */
export function normalize(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, '').toLowerCase()
}

export function filterCandidates(candidates: Candidate[], filter: BoardFilter): Candidate[] {
  const query = normalize(filter.query)
  const { position } = filter

  if (!query && !position) return candidates

  return candidates.filter((candidate) => {
    if (position && candidate.position !== position) return false
    if (query && !normalize(candidate.name).includes(query)) return false
    return true
  })
}

/** 목록에 실제로 존재하는 직무만 추린다. 고정 목록을 쓰면 데이터에 없는 값이 필터에 남는다. */
export function collectPositions(candidates: Candidate[]): string[] {
  return [...new Set(candidates.map((candidate) => candidate.position))].sort((a, b) =>
    a.localeCompare(b, 'ko'),
  )
}

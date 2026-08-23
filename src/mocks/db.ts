import type { Candidate, Stage } from '../types/candidate'
import { createSeedCandidates } from './seed'

/**
 * mock API의 저장소.
 *
 * MSW 핸들러는 프로세스 메모리에서 돌기 때문에 새로고침하면 상태가 초기화된다.
 * 그런데 요구사항은 "이동이 mock API에 저장되어 새로고침 후에도 유지"되는 것이다.
 * 그래서 메모리를 1차 저장소로 쓰되 변경마다 localStorage에 미러링한다.
 *
 * localStorage를 직접 읽고 쓰지 않고 메모리를 거치는 이유는
 * 매 요청마다 1,000건을 JSON.parse 하지 않기 위해서다.
 */

const STORAGE_KEY = 'hpb:candidates'
/** 시드나 스키마가 바뀌면 올린다. 값이 다르면 저장된 데이터를 버리고 다시 시드한다. */
const SCHEMA_VERSION = 1

interface StoredSnapshot {
  version: number
  candidates: Candidate[]
}

let memory: Candidate[] | null = null

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    // 사파리 프라이빗 모드 등에서 localStorage 접근 자체가 예외를 던진다.
    return false
  }
}

function readStorage(): Candidate[] | null {
  if (!hasStorage()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredSnapshot
    if (parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.candidates)) return null

    return parsed.candidates
  } catch {
    // 손상된 데이터로 앱 전체가 죽는 것보다 다시 시드하는 편이 낫다.
    return null
  }
}

function writeStorage(candidates: Candidate[]): void {
  if (!hasStorage()) return
  try {
    const snapshot: StoredSnapshot = { version: SCHEMA_VERSION, candidates }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // 용량 초과 등으로 저장에 실패해도 메모리 상태는 유효하다.
    // 다만 새로고침하면 사라지므로 조용히 넘기지 않고 남긴다.
    console.warn('[mock] 저장소에 쓰지 못했습니다. 새로고침하면 변경이 사라집니다.')
  }
}

function load(): Candidate[] {
  if (memory) return memory
  memory = readStorage() ?? createSeedCandidates()
  writeStorage(memory)
  return memory
}

export function resetDb(candidates?: Candidate[]): Candidate[] {
  memory = candidates ?? createSeedCandidates()
  writeStorage(memory)
  return memory
}

export function listCandidates(): Candidate[] {
  return load()
}

export function findCandidate(id: string): Candidate | undefined {
  return load().find((candidate) => candidate.id === id)
}

/**
 * 단계를 바꾸고 갱신된 카드를 돌려준다. 없는 id면 undefined.
 * revision을 올리는 곳은 여기 한 군데뿐이다.
 */
export function updateStage(id: string, stage: Stage): Candidate | undefined {
  const candidates = load()
  const index = candidates.findIndex((candidate) => candidate.id === id)
  if (index === -1) return undefined

  const updated: Candidate = {
    ...candidates[index],
    stage,
    updatedAt: new Date().toISOString(),
    revision: candidates[index].revision + 1,
  }

  candidates[index] = updated
  writeStorage(candidates)
  return updated
}

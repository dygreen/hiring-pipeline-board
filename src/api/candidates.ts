import type { Candidate, Stage } from '../types/candidate'

async function readError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null
  return new Error(body?.message ?? fallback)
}

export async function fetchCandidates(signal?: AbortSignal): Promise<Candidate[]> {
  const response = await fetch('/api/candidates', { signal })
  if (!response.ok) throw await readError(response, `요청이 실패했습니다 (${response.status})`)
  return (await response.json()) as Candidate[]
}

export async function moveCandidateStage(id: string, stage: Stage): Promise<Candidate> {
  const response = await fetch(`/api/candidates/${id}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  })
  if (!response.ok) throw await readError(response, `이동에 실패했습니다 (${response.status})`)
  return (await response.json()) as Candidate
}

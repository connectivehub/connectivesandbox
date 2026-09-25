// Real sessions adapter (Phase 6). The decision ledger lives in the
// `decisions` table; reads ride the admin-api gateway, which scopes every
// request to the session cookie's client_id server-side.

import type { DecisionRecord, SessionRecord, SessionStatus } from '@/data/types'
import { assertOk, callFunction, type FunctionResponse } from '@/data/api'

interface SessionRow {
  id: string
  client_id: string
  workflow_id: string
  kind: string
  started_at: string
  last_seen_at: string
}

interface DecisionRow {
  id: string
  session_id: string
  workflow_id: string
  judge_id: string
  question: string
  answer: string
  confidence: number
  probabilities: Record<string, number>
  latency_ms: number | null
  created_at: string
}

function withData<T>(response: FunctionResponse<T>): T {
  assertOk(response as unknown as FunctionResponse<{ error?: string }>)
  return response.data
}

function toSession(row: SessionRow): SessionRecord {
  // The spec's status vocabulary, derived here: sessions with decisions are
  // 'judged' — the dashboard derives everything else from decisions rows.
  const status: SessionStatus = 'judged'
  return {
    id: row.id,
    client_id: row.client_id,
    workflow_id: row.workflow_id,
    title: row.id,
    status,
    created_at: row.started_at,
  }
}

function toDecision(row: DecisionRow): DecisionRecord {
  return {
    id: row.id,
    session_id: row.session_id,
    workflow_id: row.workflow_id,
    judge_id: row.judge_id,
    question: row.question,
    answer: row.answer,
    confidence: row.confidence,
    disposition: 'review', // recomputed against spec thresholds by callers
    created_at: row.created_at,
    latency_ms: row.latency_ms ?? undefined,
  }
}

export async function listSessions(clientId?: string, workflowId?: string): Promise<SessionRecord[]> {
  void clientId
  const query = workflowId ? `?workflow_id=${encodeURIComponent(workflowId)}&kind=run` : '?kind=run'
  const { sessions } = withData(
    await callFunction<{ sessions: SessionRow[] }>(`/admin-api/sessions${query}`),
  )
  return sessions.map(toSession)
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  const { sessions } = withData(
    await callFunction<{ sessions: SessionRow[] }>('/admin-api/sessions'),
  )
  const row = sessions.find((entry) => entry.id === sessionId)
  return row ? toSession(row) : null
}

/** The decision ledger for one session, newest first. */
export async function listDecisions(sessionId: string, limit?: number): Promise<DecisionRecord[]> {
  const query = limit !== undefined ? `?limit=${limit}` : ''
  const { decisions } = withData(
    await callFunction<{ decisions: DecisionRow[] }>(`/admin-api/sessions/${sessionId}/decisions${query}`),
  )
  return decisions.map(toDecision)
}

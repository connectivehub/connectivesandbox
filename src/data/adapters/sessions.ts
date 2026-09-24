// BACKEND: Supabase `sessions` and `decisions` tables (RLS-scoped) replace
// these fixture reads in Phase 4.

import type { DecisionRecord, SessionRecord } from '@/data/types'
import { decisions, sessions } from '@/data/fixtures/records'

export async function listSessions(clientId?: string, workflowId?: string): Promise<SessionRecord[]> {
  return sessions.filter(
    (session) =>
      (clientId === undefined || session.client_id === clientId) &&
      (workflowId === undefined || session.workflow_id === workflowId),
  )
}

export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  return sessions.find((session) => session.id === sessionId) ?? null
}

export async function listDecisions(sessionId: string, limit?: number): Promise<DecisionRecord[]> {
  const rows = decisions
    .filter((decision) => decision.session_id === sessionId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return limit === undefined ? rows : rows.slice(0, limit)
}

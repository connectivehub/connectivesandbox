// BACKEND: Supabase `clients` table (RLS-scoped to the caller's organisation)
// replaces these fixture reads in Phase 4.

import type { Client, UsageSnapshot } from '@/data/types'
import { clients, usage } from '@/data/fixtures/records'

export async function listClients(): Promise<Client[]> {
  return clients
}

export async function getClient(id: string): Promise<Client | null> {
  return clients.find((client) => client.id === id) ?? null
}

export async function getUsageSnapshot(clientId: string, period: string): Promise<UsageSnapshot | null> {
  return usage.find((snapshot) => snapshot.client_id === clientId && snapshot.period === period) ?? null
}

// Four-digit tenant access codes shown in the admin client list.
// BACKEND: stored on the clients row (server-generated) in Phase 4.
const ACCESS_CODES: Record<string, string> = {
  clt_001: '4173',
  clt_002: '8092',
}

export async function getClientAccessCode(clientId: string): Promise<string | null> {
  return ACCESS_CODES[clientId] ?? null
}

export interface OrgUsageTotals {
  runsThisMonth: number
  decisionsMade: number
}

/** Organisation-wide totals for the usage_counter panel. */
export async function getOrgUsageTotals(): Promise<OrgUsageTotals> {
  return {
    runsThisMonth: usage.reduce((total, snapshot) => total + snapshot.sessions, 0),
    decisionsMade: usage.reduce((total, snapshot) => total + snapshot.judge_calls, 0),
  }
}

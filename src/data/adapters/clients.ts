// BACKEND: Supabase `clients` table (RLS-scoped to the caller's organisation)
// replaces these fixture reads and writes in Phase 4. CRUD lives on fixtures
// this phase, so admin actions are real but reversible by reload.

import type { Client, UsageSnapshot } from '@/data/types'
import { clients, usage } from '@/data/fixtures/records'

// Mutable fixture stores — module-level so admin CRUD round-trips stick.
const clientStore: Client[] = [...clients]
const codeStore: Record<string, string> = {
  clt_001: '4173',
  clt_002: '8092',
}

export async function listClients(): Promise<Client[]> {
  return clientStore
}

export async function getClient(id: string): Promise<Client | null> {
  return clientStore.find((client) => client.id === id) ?? null
}

export async function getClientAccessCode(clientId: string): Promise<string | null> {
  return codeStore[clientId] ?? null
}

export async function createClient(name: string, code: string): Promise<Client> {
  const id = `clt_local_${Date.now()}`
  const client: Client = {
    id,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id,
    created_at: new Date().toISOString(),
  }
  clientStore.push(client)
  codeStore[id] = code
  return client
}

export async function renameClient(clientId: string, name: string): Promise<void> {
  const client = clientStore.find((entry) => entry.id === clientId)
  if (client) {
    client.name = name
    client.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || client.slug
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const index = clientStore.findIndex((entry) => entry.id === clientId)
  if (index !== -1) clientStore.splice(index, 1)
  delete codeStore[clientId]
}

export async function getUsageSnapshot(clientId: string, period: string): Promise<UsageSnapshot | null> {
  return usage.find((snapshot) => snapshot.client_id === clientId && snapshot.period === period) ?? null
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

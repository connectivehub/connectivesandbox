// Real clients adapter (Phase 5). Admin CRUD rides the `admin-api` Edge
// Function gateway (admin cookie verified server-side, service_role applied
// inside the function — never in the browser). Same signatures as the
// Phase 1–3 fixture adapter; slug is derived from the name since the clients
// table has no slug column.

import type { Client, UsageSnapshot } from '@/data/types'
import { assertOk, callFunction, type FunctionResponse } from '@/data/api'

interface ClientRow {
  id: string
  name: string
  contact: string | null
  created_at: string
  is_active: boolean
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    slug: slugify(row.name),
    created_at: row.created_at,
  }
}

function withData<T>(response: FunctionResponse<T>): T {
  assertOk(response as unknown as FunctionResponse<{ error?: string }>)
  return response.data
}

export async function listClients(): Promise<Client[]> {
  const { clients } = withData(
    await callFunction<{ clients: ClientRow[] }>('/admin-api/clients'),
  )
  return clients.map(toClient)
}

export async function getClient(id: string): Promise<Client | null> {
  const rows = await listClients()
  return rows.find((client) => client.id === id) ?? null
}

/** Sandbox trade-off: codes are stored plaintext and read out over WhatsApp. */
export async function getClientAccessCode(clientId: string): Promise<string | null> {
  const response = await callFunction<{ access_code?: string; error?: string }>(
    `/admin-api/clients/${clientId}/access-code`,
  )
  if (response.status === 404) return null
  assertOk(response as unknown as FunctionResponse<{ error?: string }>)
  return response.data.access_code ?? null
}

export async function createClient(name: string, code: string): Promise<Client> {
  const { client } = withData(
    await callFunction<{ client: ClientRow }>('/admin-api/clients', {
      method: 'POST',
      body: { name, access_code: code },
    }),
  )
  return toClient(client)
}

export async function renameClient(clientId: string, name: string): Promise<void> {
  withData(
    await callFunction(`/admin-api/clients/${clientId}`, {
      method: 'PATCH',
      body: { name },
    }),
  )
}

export async function deleteClient(clientId: string): Promise<void> {
  withData(await callFunction(`/admin-api/clients/${clientId}`, { method: 'DELETE' }))
}

export async function getUsageSnapshot(clientId: string, period: string): Promise<UsageSnapshot | null> {
  const response = await callFunction<{
    sessions?: number
    judge_calls?: number
    error?: string
  }>(`/admin-api/usage/snapshot?client_id=${encodeURIComponent(clientId)}`)
  if (response.status === 404) return null
  assertOk(response as unknown as FunctionResponse<{ error?: string }>)
  return {
    client_id: clientId,
    period,
    sessions: response.data.sessions ?? 0,
    judge_calls: response.data.judge_calls ?? 0,
    tokens: 0,
  }
}

export interface OrgUsageTotals {
  runsThisMonth: number
  decisionsMade: number
}

/** Organisation-wide totals for the usage_counter panel. */
export async function getOrgUsageTotals(): Promise<OrgUsageTotals> {
  const data = withData(
    await callFunction<{ runsThisMonth: number; decisionsMade: number }>(
      '/admin-api/usage/totals',
    ),
  )
  return { runsThisMonth: data.runsThisMonth, decisionsMade: data.decisionsMade }
}

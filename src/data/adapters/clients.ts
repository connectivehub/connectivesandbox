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

// Warm helpers for the login gate (polish 3): fired while the session mints
// so the destination screen's first reads resolve from the viaCache layer
// instantly. Kept apart from prefetch.ts to avoid an adapter import cycle.

import { listClients } from '@/data/adapters/clients'
import { getWorkflowSpec, listWorkflows } from '@/data/adapters/workflows'
import { warm } from '@/data/prefetch'

/** Client destination: the workflows list, then the first workflow's spec. */
export function warmClientData(): void {
  warm('warm:client', async () => {
    const workflows = await listWorkflows()
    if (workflows.length > 0) await getWorkflowSpec(workflows[0].id)
  })
}

/** Admin destination: clients, then each client's workflows. */
export function warmAdminData(): void {
  warm('warm:admin', async () => {
    const clients = await listClients()
    await Promise.all(clients.map((client) => listWorkflows(client.id)))
  })
}

// BACKEND: Supabase `workflows` table storing validated WorkflowSpec JSON
// (plus versioning) replaces these fixture reads and writes in Phase 4. Specs
// stored there must pass src/engine/schema.ts before use.

import type { WorkflowSpec } from '@/engine/types'
import type { WorkflowSummary } from '@/data/types'
import { workflowSpecs } from '@/data/fixtures/workflows'

// Mutable fixture stores — module-level so admin CRUD round-trips stick.
const summaryStore: WorkflowSummary[] = [
  {
    id: 'photo-to-quote-triage',
    name: 'Photo-to-Quote Triage',
    description: 'Triage photo uploads into quotable, one-ask, or site-visit.',
    client_id: 'clt_001',
    version: 3,
    updated_at: '2026-01-04T17:20:00+08:00',
  },
  {
    id: 'document-intake-review',
    name: 'Document Intake Review',
    description: 'Classify uploaded documents and confirm the set is complete.',
    client_id: 'clt_002',
    version: 1,
    updated_at: '2025-12-18T11:05:00+08:00',
  },
]
const specStore: Record<string, WorkflowSpec> = { ...workflowSpecs }

export async function listWorkflows(clientId?: string): Promise<WorkflowSummary[]> {
  return clientId ? summaryStore.filter((summary) => summary.client_id === clientId) : summaryStore
}

export async function getWorkflowSpec(workflowId: string): Promise<WorkflowSpec | null> {
  return specStore[workflowId] ?? null
}

export async function createWorkflow(
  clientId: string,
  name: string,
  spec: WorkflowSpec | null,
): Promise<WorkflowSummary> {
  const id = `wf_local_${Date.now()}`
  const summary: WorkflowSummary = {
    id,
    name,
    description: spec?.description ?? '',
    client_id: clientId,
    version: 1,
    updated_at: new Date().toISOString(),
  }
  summaryStore.push(summary)
  if (spec !== null) specStore[id] = { ...spec, name }
  return summary
}

export async function renameWorkflow(workflowId: string, name: string): Promise<void> {
  const summary = summaryStore.find((entry) => entry.id === workflowId)
  if (summary) summary.name = name
  if (specStore[workflowId]) specStore[workflowId] = { ...specStore[workflowId], name }
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  const index = summaryStore.findIndex((entry) => entry.id === workflowId)
  if (index !== -1) summaryStore.splice(index, 1)
  delete specStore[workflowId]
}

/** Publish: stores a validated spec against the workflow and bumps version. */
export async function saveWorkflowSpec(workflowId: string, spec: WorkflowSpec): Promise<void> {
  const summary = summaryStore.find((entry) => entry.id === workflowId)
  if (summary) {
    summary.version += 1
    summary.description = spec.description
    summary.updated_at = new Date().toISOString()
  }
  specStore[workflowId] = spec
}

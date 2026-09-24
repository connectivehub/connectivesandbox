// BACKEND: Supabase `workflows` table storing validated WorkflowSpec JSON
// (plus versioning) replaces these fixture reads in Phase 4. Specs stored
// there must pass src/engine/schema.ts before use.

import type { WorkflowSpec } from '@/engine/types'
import type { WorkflowSummary } from '@/data/types'
import { workflowSpecs } from '@/data/fixtures/workflows'

const summaries: WorkflowSummary[] = [
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

export async function listWorkflows(clientId?: string): Promise<WorkflowSummary[]> {
  return clientId ? summaries.filter((summary) => summary.client_id === clientId) : summaries
}

export async function getWorkflowSpec(workflowId: string): Promise<WorkflowSpec | null> {
  return workflowSpecs[workflowId] ?? null
}

// Live judge execution. The browser NEVER talks to a judge
// provider directly — no judge credential may reach the client (invariant 5).
// `runWorkflow` calls the run-workflow Edge Function, which batches every
// judge into ONE provider call and writes the decision ledger. The admin
// live preview keeps a local provider (the deterministic mock from
// src/services/judge, no network) so building a spec never consumes judge
// calls.

import type { JudgeAnswer, JudgeProvider } from '@/engine/types'
import { mockJudgeProvider } from '@/services/judge/mock'
import { callFunction, type FunctionResponse } from '@/data/api'

export type { JudgeProvider }

/** Provider for the admin live preview: deterministic mock, no network. */
export function getPreviewJudgeProvider(): JudgeProvider {
  return mockJudgeProvider
}

export interface RunWorkflowResponse {
  ok: boolean
  session_id: string
  decisions: {
    id: string
    session_id: string
    workflow_id: string
    judge_id: string
    question: string
    answer: string
    confidence: number
    probabilities: Record<string, number>
    latency_ms: number
    created_at: string
  }[]
  results: { judgeId: string; answer: JudgeAnswer; disposition: 'auto' | 'review' | 'escalated' }[]
  analysis?: string
  failure?: { error: string; raw_response?: string }
  error?: string
}

/**
 * Run the workflow: uploads are already handled by the caller (artifact
 * adapter); intake_state carries artifact descriptors instead of File
 * objects so the judge state serializes deterministically.
 */
export async function runWorkflow(
  workflowId: string,
  intakeState: Record<string, unknown>,
  sessionId?: string,
): Promise<RunWorkflowResponse> {
  const response = await callFunction<RunWorkflowResponse>('/run-workflow', {
    method: 'POST',
    body: {
      workflow_id: workflowId,
      intake_state: intakeState,
      ...(sessionId !== undefined ? { session_id: sessionId } : {}),
    },
  })
  assertOkRun(response)
  return response.data
}

function assertOkRun(response: FunctionResponse<RunWorkflowResponse>): void {
  if (response.status >= 400) {
    throw new Error(response.data.error ?? `Run failed (${response.status})`)
  }
}

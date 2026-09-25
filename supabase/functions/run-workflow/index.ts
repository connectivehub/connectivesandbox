// run-workflow — live workflow execution (Phase 6).
//
//   POST /run-workflow
//   { workflow_id: uuid, intake_state?: object, session_id?: uuid }
//
// Flow: verify the client JWT cookie FIRST, scope everything to the JWT's
// client_id, resolve the workflow + session, then call the judge provider
// EXACTLY ONCE with every judge in the workflow batched into a single
// request. One `decisions` row is written per judge — successful or failed,
// no exceptions, no code path that skips the ledger. A judge response that
// cannot be parsed produces confidence-0 rows carrying the raw response and
// a failure surface in the response; it is NEVER silently replaced by an LLM
// judgement. Optionally, GLM narrates the `analysis` panels.
//
// Response:
// { ok, session_id, decisions: DecisionRow[], results: [...],
//   analysis?: string, failure?: { error, raw_response? } }

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { readSession } from '../_shared/jwt.ts'
import { restInsert, restSelect, restUpdate } from '../_shared/rest.ts'
import { judgeProviderFromEnv } from '../_shared/judge-env.ts'
import { glmChat, type GlmMessage } from '../_shared/glm.ts'

// Pure engine + judge service (no secrets inside; credentials injected).
import { buildJudgeQuestions, classifyAnswer } from '../../../src/engine/runner.ts'
import type { JudgeAnswer, JudgeQuestion, WorkflowSpec } from '../../../src/engine/types.ts'
import { createJudgeProvider, JudgeParseError, serializeState } from '../../../src/services/judge/index.ts'

interface WorkflowRow {
  id: string
  client_id: string
  name: string
  spec: WorkflowSpec
}

interface SessionRow {
  id: string
  client_id: string
  workflow_id: string
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
  latency_ms: number
  created_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bad(request: Request, message: string, status = 400) {
  return jsonResponse(request, { error: message }, status)
}

/** GLM narration for `analysis` panels whose source is 'llm'. */
async function narrateAnalysis(
  spec: WorkflowSpec,
  intake: Record<string, unknown>,
  questions: JudgeQuestion[],
  answers: JudgeAnswer[],
): Promise<string | undefined> {
  const analysisPanels = spec.dashboard.panels.filter(
    (panel) => panel.type === 'analysis' && panel.source === 'llm',
  )
  if (analysisPanels.length === 0) return undefined
  if (!Deno.env.get('ZAI_API_KEY')) return undefined

  const system: GlmMessage = {
    role: 'system',
    content:
      'You write the analysis panel of a workflow dashboard. You receive the judges\' ' +
      'closed-set answers with confidences and the intake context. Explain what the ' +
      'decisions mean for the user in 2-4 short sentences of plain prose. ' +
      'Never invent data beyond what is given. Do not use markdown headings.',
  }
  const user: GlmMessage = {
    role: 'user',
    content: JSON.stringify({
      workflow: { name: spec.name, description: spec.description },
      intake: intake,
      decisions: questions.map((question) => {
        const answer = answers.find((entry) => entry.id === question.id)
        return {
          question: question.question,
          answer: answer?.value ?? null,
          confidence: answer?.confidence ?? null,
        }
      }),
    }),
  }
  try {
    return (await glmChat([system, user], { maxTokens: 8192 })).trim()
  } catch (error) {
    console.log(`[run-workflow] analysis narration failed: ${error instanceof Error ? error.message : error}`)
    return undefined
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleOptions(request)
  if (request.method !== 'POST') return bad(request, 'POST required', 405)

  // Auth first: verify the client JWT cookie before anything else.
  const session = await readSession(request)
  if (!session) return bad(request, 'Not authenticated', 401)
  if (session.app_role !== 'client' || !session.client_id) {
    return bad(request, 'Client session required', 403)
  }
  const clientId = session.client_id

  let body: { workflow_id?: string; intake_state?: Record<string, unknown>; session_id?: string }
  try {
    body = await request.json()
  } catch {
    return bad(request, 'Invalid JSON body')
  }
  const workflowId = body.workflow_id ?? ''
  if (!UUID_RE.test(workflowId)) return bad(request, 'workflow_id is required')

  try {
    // Resolve the workflow, scoped to the JWT's client_id.
    const workflows = await restSelect<WorkflowRow>('workflows', {
      id: `eq.${workflowId}`,
      client_id: `eq.${clientId}`,
      select: 'id,client_id,name,spec',
      limit: '1',
    })
    const workflow = workflows[0]
    if (!workflow) return bad(request, 'Workflow not found', 404)
    const spec = workflow.spec

    // Resolve or create the session (always tenant-scoped).
    let runSession: SessionRow | null = null
    if (body.session_id && UUID_RE.test(body.session_id)) {
      const rows = await restSelect<SessionRow>('sessions', {
        id: `eq.${body.session_id}`,
        client_id: `eq.${clientId}`,
        workflow_id: `eq.${workflowId}`,
        select: 'id,client_id,workflow_id',
        limit: '1',
      })
      runSession = rows[0] ?? null
      if (!runSession) return bad(request, 'Session not found', 404)
    } else {
      const created = await restInsert<SessionRow>('sessions', {
        workflow_id: workflowId,
        client_id: clientId,
        kind: 'run',
      })
      runSession = created[0]
    }
    if (!runSession) return bad(request, 'Could not resolve session', 500)
    const sessionId = runSession.id

    const intakeState = body.intake_state ?? {}
    const questions = buildJudgeQuestions(spec)

    // Resolve the provider from secrets; one provider, one batched call.
    const resolved = judgeProviderFromEnv()
    const startedAt = Date.now()
    let answers: JudgeAnswer[] | null = null
    let failure: { error: string; raw_response?: string } | undefined

    if (questions.length === 0) {
      // Nothing to judge: still record a ledger row so the run is observable.
      failure = undefined
    } else if (resolved.provider === null) {
      failure = { error: resolved.error ?? 'judge provider unavailable' }
    } else {
      try {
        const provider = createJudgeProvider(resolved.provider.name, resolved.provider.config)
        answers = await provider.judge(intakeState, questions)
      } catch (error) {
        const rawResponse = error instanceof JudgeParseError ? error.rawResponse : undefined
        failure = {
          error: error instanceof Error ? error.message : 'judge call failed',
          ...(rawResponse !== undefined && rawResponse.length > 0 ? { raw_response: rawResponse } : {}),
        }
        console.log(`[run-workflow] judge failure: ${failure.error}`)
      }
    }
    const latencyMs = Date.now() - startedAt

    // ONE decisions row per judge — always, including the failure path
    // (confidence 0 + raw response). This is the single source of truth for
    // every dashboard number.
    const answerById = new Map((answers ?? []).map((answer) => [answer.id, answer]))
    const rows = spec.judges.map((judge) => {
      const answer = answerById.get(judge.id)
      const failed = answer === undefined
      return {
        session_id: sessionId,
        workflow_id: workflowId,
        judge_id: judge.id,
        question: judge.question,
        answer: failed ? 'unparsed' : String(answer.value),
        confidence: failed ? 0 : answer.confidence,
        probabilities: failed ? {} : answer.probabilities,
        latency_ms: latencyMs,
      }
    })
    let stored: DecisionRow[] = []
    if (rows.length > 0) {
      stored = await restInsert<DecisionRow>('decisions', rows)
    }

    await restUpdate('sessions', { id: `eq.${sessionId}` }, { last_seen_at: new Date().toISOString() })

    // Optional GLM narration for llm-sourced analysis panels (never a judge).
    let analysis: string | undefined
    if (!failure && answers !== null) {
      analysis = await narrateAnalysis(spec, intakeState, questions, answers)
    }

    const results = failure
      ? []
      : spec.judges.flatMap((judge) => {
          const answer = answerById.get(judge.id)
          if (answer === undefined) return []
          return [{
            judgeId: judge.id,
            answer,
            disposition: classifyAnswer(answer.confidence, judge.thresholds),
          }]
        })

    return jsonResponse(request, {
      ok: !failure && stored.length === rows.length,
      session_id: sessionId,
      state_sent: serializeState(intakeState).length,
      decisions: stored,
      results,
      ...(analysis !== undefined ? { analysis } : {}),
      ...(failure !== undefined ? { failure } : {}),
    })
  } catch (error) {
    console.error('[run-workflow] error:', error instanceof Error ? error.message : error)
    return bad(request, 'Internal error', 500)
  }
})

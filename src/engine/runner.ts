// Pure runner: turns intake state + a validated WorkflowSpec into judge
// results via an injected JudgeProvider. No model logic here and no imports
// from src/data/ — the provider is passed in by the caller (in Phase 4 the
// data layer supplies a real provider; fixtures supply one for now).

import type { JudgeAnswer, JudgeProvider, JudgeQuestion, WorkflowSpec } from './types'

export type JudgeDisposition = 'auto' | 'review' | 'escalated'

export interface JudgeRunResult {
  judgeId: string
  answer: JudgeAnswer
  disposition: JudgeDisposition
}

export interface JudgeRun {
  results: JudgeRunResult[]
}

/** Intake state keyed by intake component id. Values are renderer-owned. */
export type IntakeState = Record<string, unknown>

/** Build the wire-format questions for a spec's judges, in spec order. */
export function buildJudgeQuestions(spec: WorkflowSpec): JudgeQuestion[] {
  return spec.judges.map((judge) => ({
    id: judge.id,
    type: judge.question_type,
    question: judge.question,
    ...(judge.question_type === 'choice' && judge.options ? { options: judge.options } : {}),
  }))
}

/** Classify one answer against a judge's thresholds. */
export function classifyAnswer(confidence: number, thresholds: { auto: number; review: number }): JudgeDisposition {
  if (confidence >= thresholds.auto) return 'auto'
  if (confidence >= thresholds.review) return 'review'
  return 'escalated'
}

/**
 * Run every judge in the spec against the intake state using the given
 * provider, and classify each answer against that judge's thresholds.
 * Answers are matched back to judges by id; unmatched answers are ignored.
 */
export async function runJudges(
  spec: WorkflowSpec,
  intakeState: IntakeState,
  provider: JudgeProvider,
): Promise<JudgeRun> {
  const questions = buildJudgeQuestions(spec)
  const answers = await provider.judge(intakeState, questions)

  const answersById = new Map<string, JudgeAnswer>()
  for (const answer of answers) {
    if (!answersById.has(answer.id)) answersById.set(answer.id, answer)
  }

  const results: JudgeRunResult[] = []
  for (const judge of spec.judges) {
    const answer = answersById.get(judge.id)
    if (!answer) continue
    results.push({
      judgeId: judge.id,
      answer,
      disposition: classifyAnswer(answer.confidence, judge.thresholds),
    })
  }

  return { results }
}

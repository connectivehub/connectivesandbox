// Jev provider — the LIVE judge for Phase 6 (Codiv openjev via /v1/systemone).
// Contract verified live 2026-09-24 (see /home/macbooklee/firstmate/config/
// codiv-judge.env, referenced by path only):
//
//   POST {endpoint}
//   { "model": "openjev-latest", "state": string,
//     "questions": { <qid>: {"type":"choice","criteria":{opt:desc,...}}
//                    | {"type":"noul"} | {"type":"score","criteria":[...]} } }
//   -> { "model": ..., "answers": { <qid>:
//         {"type":"choice","choice":str,"confidence":float,"probabilities":{opt:float}}
//         | {"type":"noul","noul":float} },
//        "usage": {"input_tokens":n,"output_tokens":0} }
//
// All questions in a workflow are batched into ONE request and every answer
// comes back in ONE response. choice criteria is a TOP-LEVEL dict of
// option->description. Mapping to JudgeAnswer: choice is direct; noul/scalar
// maps value = noul, confidence = noul; boolean is a choice over yes/no.

import type { JudgeAnswer, JudgeProvider, JudgeQuestion } from '@/engine/types'
import { JudgeParseError, JudgeTransportError } from './errors.ts'
import { enforceBudget } from './compress.ts'

export interface JevConfig {
  endpointUrl: string
  apiKey: string
  model: string
}

interface WireQuestion {
  type: 'choice' | 'noul' | 'score'
  criteria?: Record<string, string> | string[]
}

interface WireAnswerChoice {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

interface WireAnswerNoul {
  type: 'noul'
  noul: number
}

type WireAnswer = WireAnswerChoice | WireAnswerNoul

interface WireResponse {
  answers?: Record<string, WireAnswer | undefined>
  usage?: { input_tokens?: number; output_tokens?: number }
}

/** Map a frozen JudgeQuestion to the openjev wire question. */
function toWireQuestion(question: JudgeQuestion): WireQuestion {
  if (question.type === 'choice') {
    const options = question.options ?? []
    if (options.length === 0) {
      throw new JudgeParseError(
        `choice question ${question.id} has no options`,
        '',
        [question.id],
      )
    }
    const criteria: Record<string, string> = {}
    for (const option of options) criteria[option] = option
    return { type: 'choice', criteria }
  }
  if (question.type === 'boolean') {
    return {
      type: 'choice',
      criteria: { yes: 'Yes — affirm the question', no: 'No — negate the question' },
    }
  }
  // scalar → noul: a single 0–1 float.
  return { type: 'noul' }
}

function normalizeProbabilities(raw: Record<string, number>, options: string[]): Record<string, number> {
  const probabilities: Record<string, number> = {}
  let sum = 0
  for (const [key, value] of Object.entries(raw)) {
    const numeric = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
    probabilities[key] = numeric
    sum += numeric
  }
  // Ensure every declared option appears in the distribution.
  for (const option of options) {
    if (!(option in probabilities)) probabilities[option] = 0
  }
  if (sum <= 0) return probabilities
  for (const key of Object.keys(probabilities)) {
    probabilities[key] = probabilities[key] / sum
  }
  return probabilities
}

/** Map one wire answer to the frozen JudgeAnswer shape; throw when unparseable. */
function toJudgeAnswer(question: JudgeQuestion, answer: WireAnswer | undefined): JudgeAnswer {
  if (answer === undefined || answer === null || typeof answer !== 'object') {
    throw new JudgeParseError(
      `missing answer for question ${question.id}`,
      JSON.stringify(answer ?? null),
      [question.id],
    )
  }
  if (question.type === 'scalar') {
    if (answer.type !== 'noul' || typeof answer.noul !== 'number' || !Number.isFinite(answer.noul)) {
      throw new JudgeParseError(
        `question ${question.id}: expected noul float, got ${JSON.stringify(answer)}`,
        JSON.stringify(answer),
        [question.id],
      )
    }
    const noul = Math.min(1, Math.max(0, answer.noul))
    return { id: question.id, value: noul, probabilities: {}, confidence: noul }
  }
  // choice (covers choice and boolean question types)
  if (answer.type !== 'choice' || typeof answer.choice !== 'string') {
    throw new JudgeParseError(
      `question ${question.id}: expected choice answer, got ${JSON.stringify(answer)}`,
      JSON.stringify(answer),
      [question.id],
    )
  }
  const options = question.type === 'boolean' ? ['yes', 'no'] : (question.options ?? [])
  const choice = answer.choice.toLowerCase()
  const normalizedOption = question.type === 'boolean'
    ? (choice === 'yes' ? 'yes' : choice === 'no' ? 'no' : null)
    : (options.find((option) => option === answer.choice) ?? null)
  if (normalizedOption === null) {
    throw new JudgeParseError(
      `question ${question.id}: choice "${answer.choice}" is not one of the declared options`,
      JSON.stringify(answer),
      [question.id],
    )
  }
  if (
    typeof answer.confidence !== 'number' || !Number.isFinite(answer.confidence) ||
    answer.confidence < 0 || answer.confidence > 1
  ) {
    throw new JudgeParseError(
      `question ${question.id}: confidence out of range: ${JSON.stringify(answer.confidence)}`,
      JSON.stringify(answer),
      [question.id],
    )
  }
  const probabilities = normalizeProbabilities(answer.probabilities ?? {}, normalizedOption === 'yes' || normalizedOption === 'no' ? [] : options)
  if (question.type === 'boolean') {
    probabilities[normalizedOption] = answer.confidence
    probabilities[normalizedOption === 'yes' ? 'no' : 'yes'] = 1 - answer.confidence
  }
  return {
    id: question.id,
    value: normalizedOption,
    probabilities,
    confidence: answer.confidence,
  }
}

export class JevProvider implements JudgeProvider {
  private readonly config: JevConfig

  constructor(config: JevConfig) {
    this.config = config
  }

  async judge(state: string | object, questions: JudgeQuestion[]): Promise<JudgeAnswer[]> {
    if (questions.length === 0) return []

    const { state: budgetedState } = enforceBudget(state, questions.length)
    const wireQuestions: Record<string, WireQuestion> = {}
    for (const question of questions) {
      wireQuestions[question.id] = toWireQuestion(question)
    }

    const response = await fetch(this.config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        state: budgetedState,
        questions: wireQuestions,
      }),
    })

    const rawText = await response.text()
    if (!response.ok) {
      throw new JudgeTransportError(
        `judge endpoint returned ${response.status}: ${rawText.slice(0, 400)}`,
        response.status,
      )
    }

    let parsed: WireResponse
    try {
      parsed = JSON.parse(rawText) as WireResponse
    } catch {
      throw new JudgeParseError(
        'judge response is not valid JSON',
        rawText,
        questions.map((question) => question.id),
      )
    }
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.answers !== 'object' || parsed.answers === null) {
      throw new JudgeParseError(
        'judge response has no answers object',
        rawText,
        questions.map((question) => question.id),
      )
    }

    // Every question must map to a parseable answer; one bad answer fails the
    // whole batch (run-workflow then writes confidence-0 rows for all judges).
    return questions.map((question) => toJudgeAnswer(question, parsed.answers?.[question.id]))
  }
}

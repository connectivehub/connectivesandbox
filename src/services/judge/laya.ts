// Laya providers — laya_modal and laya_space implement the Laya judge
// contract from the spec:
//
//   POST {endpoint}
//   { "state": <state>, "questions": [{ id, type, question, options? }, ...] }
//   -> { "answers": [{ id, value, confidence, probabilities? }, ...] }
//
// NOTE: no live Laya endpoint exists in this environment. The implementation
// is complete and typed against the frozen JudgeProvider interface, but it is
// UNTESTED against a real service — treat it as scaffolding until the captain
// supplies an endpoint and credentials.

import type { JudgeAnswer, JudgeProvider, JudgeQuestion } from '@/engine/types'
import { JudgeParseError, JudgeTransportError } from './errors.ts'
import { enforceBudget } from './compress.ts'

export interface LayaConfig {
  endpointUrl: string
  apiKey?: string
  /** 'modal' | 'space' — recorded on requests for observability only. */
  variant: 'modal' | 'space'
}

interface LayaWireQuestion {
  id: string
  type: 'choice' | 'boolean' | 'scalar'
  question: string
  options?: string[]
}

interface LayaWireAnswer {
  id: string
  value: string | boolean | number
  confidence: number
  probabilities?: Record<string, number>
}

interface LayaResponse {
  answers?: LayaWireAnswer[]
}

function toLayaAnswer(question: JudgeQuestion, answer: LayaWireAnswer | undefined): JudgeAnswer {
  if (answer === undefined || answer === null || typeof answer !== 'object') {
    throw new JudgeParseError(
      `missing laya answer for question ${question.id}`,
      JSON.stringify(answer ?? null),
      [question.id],
    )
  }
  if (typeof answer.confidence !== 'number' || !Number.isFinite(answer.confidence)) {
    throw new JudgeParseError(
      `question ${question.id}: laya confidence is not a number`,
      JSON.stringify(answer),
      [question.id],
    )
  }
  const confidence = Math.min(1, Math.max(0, answer.confidence))
  if (question.type === 'boolean') {
    if (typeof answer.value !== 'boolean') {
      throw new JudgeParseError(
        `question ${question.id}: expected boolean, got ${JSON.stringify(answer.value)}`,
        JSON.stringify(answer),
        [question.id],
      )
    }
    return {
      id: question.id,
      value: answer.value,
      probabilities: { true: answer.value ? confidence : 1 - confidence, false: answer.value ? 1 - confidence : confidence },
      confidence,
    }
  }
  if (question.type === 'scalar') {
    if (typeof answer.value !== 'number' || !Number.isFinite(answer.value)) {
      throw new JudgeParseError(
        `question ${question.id}: expected number, got ${JSON.stringify(answer.value)}`,
        JSON.stringify(answer),
        [question.id],
      )
    }
    return { id: question.id, value: answer.value, probabilities: {}, confidence }
  }
  const options = question.options ?? []
  if (typeof answer.value !== 'string' || !options.includes(answer.value)) {
    throw new JudgeParseError(
      `question ${question.id}: value ${JSON.stringify(answer.value)} is not one of the options`,
      JSON.stringify(answer),
      [question.id],
    )
  }
  const probabilities = { ...answer.probabilities }
  for (const option of options) if (!(option in probabilities)) probabilities[option] = 0
  probabilities[answer.value] = confidence
  return { id: question.id, value: answer.value, probabilities, confidence }
}

export class LayaProvider implements JudgeProvider {
  private readonly config: LayaConfig

  constructor(config: LayaConfig) {
    this.config = config
  }

  async judge(state: string | object, questions: JudgeQuestion[]): Promise<JudgeAnswer[]> {
    if (questions.length === 0) return []

    const { state: budgetedState } = enforceBudget(state, questions.length)
    const wireQuestions: LayaWireQuestion[] = questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      ...(question.options !== undefined ? { options: question.options } : {}),
    }))

    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-Laya-Variant': this.config.variant }
    if (this.config.apiKey !== undefined) headers.Authorization = `Bearer ${this.config.apiKey}`

    const response = await fetch(this.config.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ state: budgetedState, questions: wireQuestions }),
    })

    const rawText = await response.text()
    if (!response.ok) {
      throw new JudgeTransportError(
        `laya ${this.config.variant} endpoint returned ${response.status}: ${rawText.slice(0, 400)}`,
        response.status,
      )
    }

    let parsed: LayaResponse
    try {
      parsed = JSON.parse(rawText) as LayaResponse
    } catch {
      throw new JudgeParseError(
        `laya ${this.config.variant} response is not valid JSON`,
        rawText,
        questions.map((question) => question.id),
      )
    }
    if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.answers)) {
      throw new JudgeParseError(
        `laya ${this.config.variant} response has no answers array`,
        rawText,
        questions.map((question) => question.id),
      )
    }
    const byId = new Map(parsed.answers.map((answer) => [answer?.id, answer]))
    return questions.map((question) => toLayaAnswer(question, byId.get(question.id)))
  }
}

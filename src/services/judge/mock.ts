// Mock provider — deterministic fixture answers for tests and the admin live
// preview. Same behaviour as the Phase 1–3 fixture provider: canned answers
// for the known fixture judges, deterministic fallbacks (never free text) for
// unknown ids, with a full probability distribution over the options.

import type { JudgeAnswer, JudgeProvider, JudgeQuestion } from '@/engine/types'

function distribution(options: string[], topIndex: number, topProbability: number): Record<string, number> {
  const probabilities: Record<string, number> = {}
  const rest = options.length > 1 ? (1 - topProbability) / (options.length - 1) : 0
  options.forEach((option, index) => {
    probabilities[option] = index === topIndex ? topProbability : rest
  })
  return probabilities
}

const answersByQuestionId: Record<string, JudgeAnswer> = {
  'pricing-readiness': {
    id: 'pricing-readiness',
    value: 'one-ask',
    probabilities: distribution(['quotable', 'one-ask', 'site-visit'], 1, 0.62),
    confidence: 0.62,
  },
  'job-archetype': {
    id: 'job-archetype',
    value: 'sofa',
    probabilities: distribution(
      ['curtain', 'blind', 'carpet', 'rug', 'sofa', 'mattress', 'mixed'],
      4,
      0.58,
    ),
    confidence: 0.58,
  },
  'follow-up-question': {
    id: 'follow-up-question',
    value: 'fabric_type',
    probabilities: distribution(
      ['window_width', 'fabric_type', 'ceiling_height', 'room_access', 'budget_range'],
      1,
      0.55,
    ),
    confidence: 0.55,
  },
  'document-classification': {
    id: 'document-classification',
    value: 'invoice',
    probabilities: distribution(['invoice', 'contract', 'receipt', 'correspondence', 'other'], 0, 0.97),
    confidence: 0.97,
  },
  'document-completeness': {
    id: 'document-completeness',
    value: 'complete',
    probabilities: distribution(['complete', 'missing-pages', 'illegible', 'wrong-document'], 0, 0.9),
    confidence: 0.9,
  },
}

/** Stable 0–1 hash so mock confidences are deterministic per question id. */
function stableUnit(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index++) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  }
  return 0.55 + ((hash % 45) / 100)
}

function answerFor(question: JudgeQuestion): JudgeAnswer {
  const canned = answersByQuestionId[question.id]
  if (canned) return canned
  const confidence = stableUnit(question.id)
  if (question.type === 'choice' && question.options && question.options.length > 0) {
    const options = question.options
    const topIndex = Math.floor(stableUnit(`${question.id}:top`) * options.length) % options.length
    return {
      id: question.id,
      value: options[topIndex] ?? '',
      probabilities: distribution(options, topIndex, Math.min(0.95, confidence + 0.05)),
      confidence,
    }
  }
  if (question.type === 'boolean') {
    const value = stableUnit(`${question.id}:bool`) >= 0.75
    return {
      id: question.id,
      value,
      probabilities: value ? { true: confidence, false: 1 - confidence } : { true: 1 - confidence, false: confidence },
      confidence,
    }
  }
  return { id: question.id, value: Math.round(confidence * 100) / 100, probabilities: {}, confidence }
}

export const mockJudgeProvider: JudgeProvider = {
  async judge(_state: string | object, questions: JudgeQuestion[]): Promise<JudgeAnswer[]> {
    return questions.map(answerFor)
  },
}

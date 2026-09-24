// Fixture judge provider: canned JudgeAnswers for the two fixture specs'
// judges, shaped for the frozen JudgeProvider interface. A judge never returns
// free text — values are drawn from the judge's options (choice), booleans, or
// numbers, with a full probability distribution over the options.

import type { JudgeAnswer, JudgeQuestion, JudgeProvider } from '@/engine/types'

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

function answerFor(question: JudgeQuestion): JudgeAnswer {
  const canned = answersByQuestionId[question.id]
  if (canned) return canned
  // Unknown judge: answer the first option for choice questions, or a neutral
  // boolean/scalar, always with a full distribution and low confidence.
  if (question.type === 'choice' && question.options && question.options.length > 0) {
    const options = question.options
    return {
      id: question.id,
      value: options[0] ?? '',
      probabilities: distribution(options, 0, 0.5),
      confidence: 0.5,
    }
  }
  if (question.type === 'boolean') {
    return { id: question.id, value: false, probabilities: { true: 0.5, false: 0.5 }, confidence: 0.5 }
  }
  return { id: question.id, value: 0, probabilities: {}, confidence: 0.5 }
}

export const fixtureJudgeProvider: JudgeProvider = {
  async judge(_state: string | object, questions: JudgeQuestion[]): Promise<JudgeAnswer[]> {
    return questions.map(answerFor)
  },
}

// BACKEND: the real judge provider lands in Phase 4 — an edge-function call to
// the model, returning JudgeAnswer values only (never free text). Until then
// this adapter serves the fixture provider. The engine receives it by
// injection; it never imports this file.

import type { JudgeProvider } from '@/engine/types'
import { fixtureJudgeProvider } from '@/data/fixtures/judge'

export function getJudgeProvider(): JudgeProvider {
  return fixtureJudgeProvider
}

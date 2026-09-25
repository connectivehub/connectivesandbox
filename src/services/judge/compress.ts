// Deterministic state compression for batched judge calls.
//
// Budget: 512 tokens per question INCLUDING the shared state. A token is
// estimated at 4 characters (deterministic, dependency-free). If the batched
// request exceeds 512 × questionCount tokens, the state is compressed through
// a deterministic algorithm (stable key order, proportional per-field
// clipping, head+tail string truncation) and the event is LOGGED via
// console.log so the truncation is observable in the Edge Function logs.

/** Conservative deterministic token estimate: 1 token ≈ 4 characters. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export const TOKENS_PER_QUESTION = 512

export interface CompressionResult {
  state: string
  compressed: boolean
  originalTokens: number
  finalTokens: number
}

/** Serialize intake state to the deterministic text form sent to the judge. */
export function serializeState(state: string | object): string {
  if (typeof state === 'string') return state
  try {
    return JSON.stringify(state, Object.keys(state).sort())
  } catch {
    return String(state)
  }
}

/** Clip a single string, keeping its head and a short tail. */
function clipString(value: string, keepChars: number): string {
  if (value.length <= keepChars) return value
  if (keepChars <= 24) return value.slice(0, Math.max(0, keepChars)) + '…'
  const tailKeep = Math.floor(keepChars / 4)
  const headKeep = keepChars - tailKeep
  return `${value.slice(0, headKeep)}…[clipped ${value.length - keepChars} chars]…${value.slice(value.length - tailKeep)}`
}

/**
 * Compress a serialized state string to fit the target token budget.
 * Deterministic: same input + same budget always yields the same output.
 */
export function compressStateText(state: string, targetTokens: number): string {
  const targetChars = Math.max(0, targetTokens) * 4
  if (state.length <= targetChars) return state

  // Try to shrink object-shaped states field by field (sorted keys) before
  // falling back to whole-string clipping.
  try {
    const parsed = JSON.parse(state) as unknown
    if (parsed !== null && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      const keys = Object.keys(record).sort()
      const overhead = state.length - keys.reduce(
        (sum, key) => sum + String(record[key]).length, 0,
      )
      const stringFields = keys.filter((key) => typeof record[key] === 'string')
      const stringChars = stringFields.reduce(
        (sum, key) => sum + (record[key] as string).length, 0,
      )
      if (stringChars > 0 && targetChars > overhead) {
        const keepRatio = Math.min(1, (targetChars - overhead) / stringChars)
        const compressed: Record<string, unknown> = {}
        for (const key of keys) {
          const value = record[key]
          if (typeof value === 'string') {
            compressed[key] = clipString(value, Math.floor(value.length * keepRatio))
          } else if (value !== null && typeof value === 'object') {
            // Nested structures are re-serialized clipped as text.
            compressed[key] = clipString(JSON.stringify(value), 512)
          } else {
            compressed[key] = value
          }
        }
        return JSON.stringify(compressed, keys)
      }
    }
  } catch {
    // Not JSON — fall through to whole-string clipping.
  }
  return clipString(state, targetChars)
}

/**
 * Enforce the per-question token budget over a batched request. Returns the
 * (possibly compressed) state text and whether compression fired, so the
 * caller can LOG the event.
 */
export function enforceBudget(
  state: string | object,
  questionCount: number,
): CompressionResult {
  const serialized = serializeState(state)
  const questionTokens = questionCount * TOKENS_PER_QUESTION
  const originalTokens = estimateTokens(serialized)
  // The state alone must fit within the batch budget with room for the
  // questions themselves (~64 tokens each).
  const stateBudget = Math.max(64, questionTokens - questionCount * 64)
  if (originalTokens <= stateBudget) {
    return { state: serialized, compressed: false, originalTokens, finalTokens: originalTokens }
  }
  const compressedText = compressStateText(serialized, stateBudget)
  console.log(
    `[judge] budget: state compressed deterministically — ` +
      `${originalTokens} tokens → ${estimateTokens(compressedText)} tokens ` +
      `(budget ${stateBudget} for ${questionCount} question(s))`,
  )
  return {
    state: compressedText,
    compressed: true,
    originalTokens,
    finalTokens: estimateTokens(compressedText),
  }
}

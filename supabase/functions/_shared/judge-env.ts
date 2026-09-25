// Judge provider configuration from Edge Function secrets. Credentials live
// in the platform secret store (JUDGE_PROVIDER, JUDGE_ENDPOINT_URL,
// JUDGE_API_KEY, JUDGE_MODEL) and are read ONLY here, server-side.

import type { JudgeProviderConfig, JudgeProviderName } from '../../../src/services/judge/factory.ts'
import { isJudgeProviderName } from '../../../src/services/judge/factory.ts'

export interface JudgeEnv {
  name: JudgeProviderName
  config: JudgeProviderConfig
}

/**
 * Resolve the judge provider from the environment. Defaults to jev (the live
 * provider) and falls back to mock when credentials are absent so a
 * misconfigured secret surfaces as deterministic mock answers rather than
 * a crashed workflow run.
 */
export function judgeProviderFromEnv(): { provider: JudgeEnv | null; error?: string } {
  const raw = Deno.env.get('JUDGE_PROVIDER')
  const name = isJudgeProviderName(raw) ? raw : 'jev'
  if (name === 'mock') return { provider: { name, config: {} } }
  if (name === 'jev') {
    const endpointUrl = Deno.env.get('JUDGE_ENDPOINT_URL')
    const apiKey = Deno.env.get('JUDGE_API_KEY')
    const model = Deno.env.get('JUDGE_MODEL') ?? 'openjev-latest'
    if (!endpointUrl || !apiKey) {
      return { provider: null, error: 'JUDGE_ENDPOINT_URL / JUDGE_API_KEY secrets are not configured' }
    }
    return { provider: { name, config: { jev: { endpointUrl, apiKey, model } } } }
  }
  // laya_modal / laya_space — no live endpoint in this environment; use
  // LAYA_ENDPOINT_URL if the operator ever supplies one.
  const endpointUrl = Deno.env.get('LAYA_ENDPOINT_URL')
  if (!endpointUrl) {
    return { provider: null, error: `${name} selected but LAYA_ENDPOINT_URL is not configured` }
  }
  return {
    provider: {
      name,
      config: { laya: { endpointUrl, apiKey: Deno.env.get('LAYA_API_KEY'), variant: name === 'laya_modal' ? 'modal' : 'space' } },
    },
  }
}

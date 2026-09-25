// Judge provider factory: selects among laya_modal, laya_space, jev and mock
// by name. The Edge Function reads JUDGE_PROVIDER + the matching credentials
// from the environment and passes them in as plain config — no secret ever
// lives inside this module, so the mock/factory are safe to import anywhere.

import type { JudgeProvider } from '@/engine/types'
import { JevProvider, type JevConfig } from './jev.ts'
import { LayaProvider, type LayaConfig } from './laya.ts'
import { mockJudgeProvider } from './mock.ts'

export type JudgeProviderName = 'laya_modal' | 'laya_space' | 'jev' | 'mock'

export interface JudgeProviderConfig {
  jev?: JevConfig
  laya?: LayaConfig
}

export function isJudgeProviderName(value: string | undefined | null): value is JudgeProviderName {
  return value === 'laya_modal' || value === 'laya_space' || value === 'jev' || value === 'mock'
}

export function createJudgeProvider(
  name: JudgeProviderName,
  config: JudgeProviderConfig = {},
): JudgeProvider {
  switch (name) {
    case 'jev': {
      if (config.jev === undefined) {
        throw new Error('jev provider selected but no jev config was supplied')
      }
      return new JevProvider(config.jev)
    }
    case 'laya_modal':
    case 'laya_space': {
      if (config.laya === undefined) {
        throw new Error(`${name} provider selected but no laya config was supplied`)
      }
      return new LayaProvider({ ...config.laya, variant: name === 'laya_modal' ? 'modal' : 'space' })
    }
    case 'mock':
      return mockJudgeProvider
  }
}

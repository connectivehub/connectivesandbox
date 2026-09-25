// Public surface of the judge provider service. The engine receives a
// JudgeProvider by injection; only the Edge Functions import the live
// providers (their credentials never reach the browser).

export { JudgeParseError, JudgeTransportError } from './errors.ts'
export { estimateTokens, enforceBudget, serializeState, TOKENS_PER_QUESTION } from './compress.ts'
export { JevProvider, type JevConfig } from './jev.ts'
export { LayaProvider, type LayaConfig } from './laya.ts'
export { mockJudgeProvider } from './mock.ts'
export {
  createJudgeProvider,
  isJudgeProviderName,
  type JudgeProviderConfig,
  type JudgeProviderName,
} from './factory.ts'

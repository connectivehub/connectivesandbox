// Shared state for one workflow run: intake values, judge results from the
// pure runner (fed the fixture provider by injection), and the local decision
// log. The registry's props contract stays { component | panel } — everything
// else flows through this context, so the same renderers serve the workspace
// and the admin live preview.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { runJudges, type IntakeState, type JudgeRunResult } from '@/engine/runner'
import type { WorkflowSpec } from '@/engine/types'
import type { DecisionRecord } from '@/data/types'
import { getJudgeProvider } from '@/data/adapters/judge'

export type RunStatus = 'idle' | 'running' | 'ready'

interface WorkspaceContextValue {
  workflowId: string
  spec: WorkflowSpec
  intake: IntakeState
  runStatus: RunStatus
  results: JudgeRunResult[]
  decisions: DecisionRecord[]
  runCount: number
  run: () => void
  setIntakeValue: (id: string, value: unknown) => void
  getIntakeValue: (id: string) => unknown
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  workflowId,
  spec,
  children,
}: {
  workflowId: string
  spec: WorkflowSpec
  children: ReactNode
}) {
  const [intake, setIntake] = useState<IntakeState>({})
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [results, setResults] = useState<JudgeRunResult[]>([])
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [runCount, setRunCount] = useState(0)
  const runningRef = useRef(false)

  const setIntakeValue = useCallback((id: string, value: unknown) => {
    setIntake((previous) => ({ ...previous, [id]: value }))
  }, [])

  const getIntakeValue = useCallback((id: string) => intake[id], [intake])

  const run = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setRunStatus('running')
    void (async () => {
      const startedAt = performance.now()
      const judgeRun = await runJudges(spec, intake, getJudgeProvider())
      const elapsedMs = performance.now() - startedAt
      const questionByJudgeId = new Map(spec.judges.map((judge) => [judge.id, judge.question]))
      const now = new Date().toISOString()
      // One provider call covers all judges; fixture latency attribution
      // spreads the measured elapsed time across the rows.
      const rows: DecisionRecord[] = judgeRun.results.map((result, index) => ({
        id: `dec_local_${Date.now()}_${result.judgeId}`,
        session_id: 'local',
        workflow_id: workflowId,
        judge_id: result.judgeId,
        question: questionByJudgeId.get(result.judgeId) ?? result.judgeId,
        answer: result.answer.value,
        confidence: result.answer.confidence,
        disposition: result.disposition,
        created_at: now,
        latency_ms: Math.max(120, Math.round(elapsedMs / judgeRun.results.length) + index * 37),
      }))
      setResults(judgeRun.results)
      setDecisions((previous) => [...rows, ...previous])
      setRunCount((previous) => previous + 1)
      setRunStatus('ready')
      runningRef.current = false
    })()
  }, [intake, spec, workflowId])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workflowId,
      spec,
      intake,
      runStatus,
      results,
      decisions,
      runCount,
      run,
      setIntakeValue,
      getIntakeValue,
    }),
    [workflowId, spec, intake, runStatus, results, decisions, runCount, run, setIntakeValue, getIntakeValue],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace must be used inside a WorkspaceProvider')
  }
  return context
}

// Shared state for one workflow run: intake values, judge results from the
// pure runner (fed the fixture provider by injection), and the local decision
// log. The registry's props contract stays { component | panel } — everything
// else flows through this context, so the same renderers serve the workspace
// and the admin live preview.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  dashboardExpanded: boolean
  setDashboardExpanded: (expanded: boolean) => void
  /** True when every blocking intake component has a value. */
  intakeComplete: boolean
  run: () => void
  setIntakeValue: (id: string, value: unknown) => void
  getIntakeValue: (id: string) => unknown
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/** Components whose completion blocks a submit. */
export function isIntakeComplete(spec: WorkflowSpec, intake: IntakeState): boolean {
  return spec.intake.components.every((component) => {
    const value = intake[component.id]
    switch (component.type) {
      case 'form': {
        const record = (value ?? {}) as Record<string, unknown>
        return component.fields.every(
          (field) => !field.required || String(record[field.id] ?? '').trim().length > 0,
        )
      }
      case 'button_group':
        if (Array.isArray(value)) return value.length > 0
        return value !== undefined && value !== null && value !== ''
      case 'text_field':
        return typeof value === 'string' && value.trim().length > 0
      default:
        // chat submits explicitly; file_upload never blocks.
        return true
    }
  })
}

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
  // Dashboard defaults to the side panel on wide viewports and the banner
  // below the tablet breakpoint. A manual toggle wins until the viewport
  // crosses the breakpoint again, then the responsive default takes over.
  const TABLET_QUERY = '(min-width: 1024px)'
  const [isWide, setIsWide] = useState(() => window.matchMedia(TABLET_QUERY).matches)
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null)
  useEffect(() => {
    const query = window.matchMedia(TABLET_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      setManualExpanded(null)
      setIsWide(event.matches)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  const dashboardExpanded = manualExpanded ?? isWide
  const setDashboardExpanded = useCallback((expanded: boolean) => {
    setManualExpanded(expanded)
  }, [])
  const runningRef = useRef(false)
  // Latest intake snapshot so runs never read stale state from a closure.
  const intakeRef = useRef<IntakeState>({})

  const setIntakeValue = useCallback((id: string, value: unknown) => {
    setIntake((previous) => {
      const next = { ...previous, [id]: value }
      intakeRef.current = next
      return next
    })
  }, [])

  const getIntakeValue = useCallback((id: string) => intake[id], [intake])

  const run = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true
    setRunStatus('running')
    void (async () => {
      const startedAt = performance.now()
      const judgeRun = await runJudges(spec, intakeRef.current, getJudgeProvider())
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
  }, [spec, workflowId])

  const intakeComplete = isIntakeComplete(spec, intake)

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workflowId,
      spec,
      intake,
      runStatus,
      results,
      decisions,
      runCount,
      dashboardExpanded,
      setDashboardExpanded,
      intakeComplete,
      run,
      setIntakeValue,
      getIntakeValue,
    }),
    [
      workflowId,
      spec,
      intake,
      runStatus,
      results,
      decisions,
      runCount,
      dashboardExpanded,
      setDashboardExpanded,
      intakeComplete,
      run,
      setIntakeValue,
      getIntakeValue,
    ],
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

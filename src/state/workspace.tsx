// Shared state for one workflow run: intake values, judge results, and the
// decision ledger. Two modes:
//
//   'live'    — the client workspace. Submitting the intake (or sending a
//               chat message) calls the run-workflow Edge Function, which
//               batches all judges into ONE provider call and writes the
//               decision ledger; every dashboard number traces to those
//               `decisions` rows returned from the server.
//               every dashboard number traces to those `decisions` rows
//               returned from the server.
//   'preview' — the admin live preview. Runs stay local on the
//               deterministic mock provider so building a spec never
//               consumes judge calls or writes ledger rows.

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

import { classifyAnswer, runJudges, type IntakeState, type JudgeRunResult } from '@/engine/runner'
import type { WorkflowSpec } from '@/engine/types'
import type { DecisionRecord } from '@/data/types'
import { getPreviewJudgeProvider, runWorkflow } from '@/data/adapters/judge'
import { ensureRunSession, uploadArtifact, type SessionRef } from '@/data/adapters/artifacts'
import { sendMessage } from '@/data/adapters/chat'

export type RunStatus = 'idle' | 'running' | 'ready'
export type WorkspaceMode = 'live' | 'preview'

interface WorkspaceContextValue {
  workflowId: string
  mode: WorkspaceMode
  spec: WorkflowSpec
  intake: IntakeState
  runStatus: RunStatus
  results: JudgeRunResult[]
  decisions: DecisionRecord[]
  runCount: number
  sessionId: string | null
  runError: string | null
  analysis: string | null
  dashboardExpanded: boolean
  setDashboardExpanded: (expanded: boolean) => void
  /** True when every blocking intake component has a value. */
  intakeComplete: boolean
  run: () => void
  setIntakeValue: (id: string, value: unknown) => void
  getIntakeValue: (id: string) => unknown
  /** Live chat: persist + stream one message (uploads attachments first). */
  sendChatMessage: (
    content: string,
    files: File[],
    onDelta?: (delta: string) => void,
  ) => Promise<void>
  chatBusy: boolean
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

/** Files are never serialized to the judge — only their artifact descriptors. */
function isFileList(value: unknown): value is File[] {
  return Array.isArray(value) && value.every((entry) => entry instanceof File)
}

export function WorkspaceProvider({
  workflowId,
  spec,
  mode = 'preview',
  children,
}: {
  workflowId: string
  spec: WorkflowSpec
  mode?: WorkspaceMode
  children: ReactNode
}) {
  const [intake, setIntake] = useState<IntakeState>({})
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [results, setResults] = useState<JudgeRunResult[]>([])
  const [decisions, setDecisions] = useState<DecisionRecord[]>([])
  const [runCount, setRunCount] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [chatBusy, setChatBusy] = useState(false)
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
  const sessionRef = useRef<SessionRef | null>(null)

  const setIntakeValue = useCallback((id: string, value: unknown) => {
    setIntake((previous) => {
      const next = { ...previous, [id]: value }
      intakeRef.current = next
      return next
    })
  }, [])

  const getIntakeValue = useCallback((id: string) => intake[id], [intake])

  /** Resolve (or create) the run session and upload any raw files. */
  const prepareState = useCallback(
    async (
      state: IntakeState,
    ): Promise<{ judgeState: Record<string, unknown>; artifactIds: string[] }> => {
      if (sessionRef.current === null) {
        sessionRef.current = await ensureRunSession(workflowId)
        setSessionId(sessionRef.current.id)
      }
      const judgeState: Record<string, unknown> = {}
      const artifactIds: string[] = []
      for (const [key, value] of Object.entries(state)) {
        if (isFileList(value) && value.length > 0) {
          const descriptors = await Promise.all(
            value.map(async (file) => {
              const artifact = await uploadArtifact(sessionRef.current!.id, file)
              artifactIds.push(artifact.id)
              return {
                artifact_id: artifact.id,
                filename: artifact.filename,
                mime_type: artifact.mime_type,
                size: artifact.size,
              }
            }),
          )
          judgeState[key] = descriptors
        } else if (!isFileList(value)) {
          judgeState[key] = value
        }
      }
      return { judgeState, artifactIds }
    },
    [workflowId],
  )

  /** Merge server ledger rows into the dashboard state. */
  const applyRunResponse = useCallback(
    (response: Awaited<ReturnType<typeof runWorkflow>>) => {
      const questionByJudgeId = new Map(spec.judges.map((judge) => [judge.id, judge]))
      const rows: DecisionRecord[] = response.decisions.map((row) => {
        const judge = questionByJudgeId.get(row.judge_id)
        return {
          id: row.id,
          session_id: row.session_id,
          workflow_id: row.workflow_id,
          judge_id: row.judge_id,
          question: row.question,
          answer: row.answer,
          confidence: row.confidence,
          disposition: judge !== undefined
            ? classifyAnswer(row.confidence, judge.thresholds)
            : 'review',
          created_at: row.created_at,
          latency_ms: row.latency_ms,
        }
      })
      setResults(response.results)
      setDecisions((previous) => [...rows, ...previous])
      setRunCount((previous) => previous + 1)
      setAnalysis(response.analysis ?? null)
      setRunError(response.failure !== undefined ? response.failure.error : null)
    },
    [spec],
  )

  const run = useCallback(() => {
    if (runningRef.current) return
    if (mode === 'preview') {
      // Preview: local mock run, no network, no ledger writes.
      runningRef.current = true
      setRunStatus('running')
      void (async () => {
        const judgeRun = await runJudges(spec, intakeRef.current, getPreviewJudgeProvider())
        const questionByJudgeId = new Map(spec.judges.map((judge) => [judge.id, judge.question]))
        const now = new Date().toISOString()
        const rows: DecisionRecord[] = judgeRun.results.map((result) => ({
          id: `dec_local_${Date.now()}_${result.judgeId}`,
          session_id: 'local',
          workflow_id: workflowId,
          judge_id: result.judgeId,
          question: questionByJudgeId.get(result.judgeId) ?? result.judgeId,
          answer: result.answer.value,
          confidence: result.answer.confidence,
          disposition: result.disposition,
          created_at: now,
        }))
        setResults(judgeRun.results)
        setDecisions((previous) => [...rows, ...previous])
        setRunCount((previous) => previous + 1)
        setRunStatus('ready')
        runningRef.current = false
      })()
      return
    }

    runningRef.current = true
    setRunStatus('running')
    setRunError(null)
    void (async () => {
      try {
        const { judgeState } = await prepareState(intakeRef.current)
        const response = await runWorkflow(
          workflowId,
          judgeState,
          sessionRef.current?.id,
        )
        applyRunResponse(response)
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'Run failed')
      } finally {
        setRunStatus('ready')
        runningRef.current = false
      }
    })()
  }, [spec, workflowId, mode, prepareState, applyRunResponse])

  /** Live chat: upload attachments → run the judges → stream the reply. */
  const sendChatMessage = useCallback(
    async (content: string, files: File[], onDelta?: (delta: string) => void) => {
      if (mode !== 'live' || chatBusy) return
      setChatBusy(true)
      try {
        // Attachments ride the chat component's intake slot so the judge
        // state sees their artifact descriptors.
        const chatComponent = spec.intake.components.find(
          (component) => component.type === 'chat',
        )
        const stateWithChat: IntakeState = {
          ...intakeRef.current,
          ...(chatComponent !== undefined ? { [chatComponent.id]: files } : {}),
        }
        const { judgeState, artifactIds } = await prepareState(stateWithChat)
        const response = await runWorkflow(workflowId, judgeState, sessionRef.current?.id)
        applyRunResponse(response)
        await sendMessage(
          sessionRef.current!.id,
          content,
          artifactIds,
          (delta) => onDelta?.(delta),
        )
      } finally {
        setChatBusy(false)
      }
    },
    [mode, chatBusy, spec, workflowId, prepareState, applyRunResponse],
  )

  const intakeComplete = isIntakeComplete(spec, intake)

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workflowId,
      mode,
      spec,
      intake,
      runStatus,
      results,
      decisions,
      runCount,
      sessionId,
      runError,
      analysis,
      dashboardExpanded,
      setDashboardExpanded,
      intakeComplete,
      run,
      setIntakeValue,
      getIntakeValue,
      sendChatMessage,
      chatBusy,
    }),
    [
      workflowId,
      mode,
      spec,
      intake,
      runStatus,
      results,
      decisions,
      runCount,
      sessionId,
      runError,
      analysis,
      dashboardExpanded,
      setDashboardExpanded,
      intakeComplete,
      run,
      setIntakeValue,
      getIntakeValue,
      sendChatMessage,
      chatBusy,
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

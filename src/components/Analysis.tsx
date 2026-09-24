// Registry entry for dashboard panel type "analysis": titled prose block with
// loading skeleton. On fixtures the prose is assembled from the latest judge
// run; BACKEND: LLM-generated analysis from Phase 4.

import type { DashboardPanel } from '@/engine/types'
import { formatAnswerValue, formatPercent } from '@/lib/format'
import { Skeleton } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type AnalysisPanel = Extract<DashboardPanel, { type: 'analysis' }>

export default function Analysis({ panel }: { panel: AnalysisPanel }) {
  const { spec, results, runStatus } = useWorkspace()

  if (runStatus === 'running') {
    return (
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold tracking-tight text-ink">{panel.title}</h3>
        <p className="text-sm text-slate-400">
          Run the workflow to generate the analysis for this job.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold tracking-tight text-ink">{panel.title}</h3>
      <div className="space-y-2 text-sm leading-relaxed text-slate-600">
        <p>
          The judges reviewed this submission against {spec.judges.length} question
          {spec.judges.length === 1 ? '' : 's'} and returned {results.length} decision
          {results.length === 1 ? '' : 's'}.
        </p>
        {results.map((result) => {
          const judge = spec.judges.find((entry) => entry.id === result.judgeId)
          return (
            <p key={result.judgeId}>
              <span className="font-medium text-ink">{judge?.question ?? result.judgeId}</span>{' '}
              {formatAnswerValue(result.answer.value)} at{' '}
              {formatPercent(result.answer.confidence)} confidence ({result.disposition}).
            </p>
          )
        })}
      </div>
    </div>
  )
}

// Registry entry for dashboard panel type "confidence_meter": horizontal
// 0-100% bar with the selected option, percentage, and runner-up. Green above
// the auto threshold, amber between auto and review, red below review; below
// auto the panel explains what the judge would need to be sure.

import type { DashboardPanel } from '@/engine/types'
import { classifyAnswer } from '@/engine/runner'
import { formatAnswerValue, formatPercent } from '@/lib/format'
import { Badge, MeterBar, Skeleton } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type ConfidenceMeterPanel = Extract<DashboardPanel, { type: 'confidence_meter' }>

export default function ConfidenceMeter({ panel }: { panel: ConfidenceMeterPanel }) {
  const { spec, results, runStatus } = useWorkspace()
  const judge = spec.judges.find((entry) => entry.id === panel.judge_id)
  const result = results.find((entry) => entry.judgeId === panel.judge_id)

  if (runStatus === 'running') {
    return (
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-48" />
      </div>
    )
  }

  if (!judge || !result) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold tracking-tight text-ink">{panel.label}</h3>
        <div className="h-2 w-full rounded-full border border-dashed border-slate-200 bg-slate-50" />
        <p className="text-sm text-slate-400">
          Not run yet — run the workflow to score this judge.
        </p>
      </div>
    )
  }

  const disposition = classifyAnswer(result.answer.confidence, judge.thresholds)
  const ranked = Object.entries(result.answer.probabilities).sort((a, b) => b[1] - a[1])
  const runnerUp = ranked[1]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold tracking-tight text-ink">{panel.label}</h3>
        <Badge tone={disposition}>
          {disposition === 'auto' ? 'Auto' : disposition === 'review' ? 'Review' : 'Escalated'}
        </Badge>
      </div>
      <MeterBar
        confidence={result.answer.confidence}
        tone={disposition}
        review={judge.thresholds.review}
        auto={judge.thresholds.auto}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-ink">
          {formatAnswerValue(result.answer.value)}
          <span className="ml-2 font-bold text-accent">
            {formatPercent(result.answer.confidence)}
          </span>
        </p>
        {runnerUp && (
          <p className="text-xs text-slate-400">
            Runner-up: {formatAnswerValue(runnerUp[0])} · {formatPercent(runnerUp[1])}
          </p>
        )}
      </div>
      <p className="text-xs leading-relaxed text-slate-400">
        {disposition === 'auto'
          ? `Confidence is at or above the ${formatPercent(judge.thresholds.auto)} auto threshold — no human review needed.`
          : disposition === 'review'
            ? `Confidence sits between the ${formatPercent(judge.thresholds.review)} review and ${formatPercent(judge.thresholds.auto)} auto thresholds — a human should confirm before this decides.`
            : `Below the ${formatPercent(judge.thresholds.review)} review threshold. The judge would need at least ${formatPercent(judge.thresholds.auto)} to be sure — add more detail to raise confidence.`}
      </p>
    </div>
  )
}

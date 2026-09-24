// Observability banner: the collapsed form of the dashboard. One or two
// lines — per confidence meter a colour-coded dot and percentage, plus compact
// run/decision counters. Built from the same data-panel primitives as the
// panes so future observability functions slot in. Click (or tap) expands the
// full dashboard.

import { ChevronUp, Loader2 } from 'lucide-react'

import { classifyAnswer } from '@/engine/runner'
import type { DashboardPanel } from '@/engine/types'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

const dotTone: Record<string, string> = {
  auto: 'bg-emerald-500',
  review: 'bg-amber-500',
  escalated: 'bg-red-500',
}

export default function ObservabilityBanner() {
  const { spec, results, decisions, runCount, runStatus, setDashboardExpanded } = useWorkspace()
  const meterPanels = spec.dashboard.panels.filter(
    (panel): panel is Extract<DashboardPanel, { type: 'confidence_meter' }> =>
      panel.type === 'confidence_meter',
  )

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setDashboardExpanded(true)}
        aria-expanded={false}
        aria-label="Expand dashboard"
        className="flex w-full items-center gap-4 px-4 py-2 text-left transition hover:bg-accent-tint"
      >
        <Eyebrow className="shrink-0">Dashboard</Eyebrow>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          {meterPanels.map((panel) => {
            const judge = spec.judges.find((entry) => entry.id === panel.judge_id)
            const result = results.find((entry) => entry.judgeId === panel.judge_id)
            const disposition =
              judge !== undefined && result !== undefined
                ? classifyAnswer(result.answer.confidence, judge.thresholds)
                : null
            return (
              <span key={panel.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    disposition !== null ? dotTone[disposition] : 'bg-slate-300',
                  )}
                />
                <span className="font-medium text-ink">{panel.label}</span>
                <span className="font-semibold text-slate-600">
                  {result !== undefined ? formatPercent(result.answer.confidence) : '—'}
                </span>
              </span>
            )
          })}
          <span className="text-xs text-slate-400">
            Runs {runCount} · Decisions {decisions.length}
          </span>
          {runStatus === 'running' && (
            <Loader2 size={13} aria-hidden="true" className="animate-spin text-accent" />
          )}
        </span>
        <ChevronUp size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
      </button>
    </div>
  )
}

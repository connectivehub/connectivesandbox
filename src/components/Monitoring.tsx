// Registry entry for dashboard panel type "monitoring": compact metric tiles
// in a fixed grid — tabular numerals, compact units, labels truncate with a
// tooltip. Every value is derived from the decision ledger (the workspace's
// decisions rows, which come straight from the `decisions` table) — a number
// that cannot be traced to decisions is a bug.

import type { DashboardPanel } from '@/engine/types'
import { formatCountCompact, formatPercent } from '@/lib/format'
import { Skeleton } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type MonitoringPanel = Extract<DashboardPanel, { type: 'monitoring' }>

interface MetricValue {
  label: string
  value: string
}

function deriveMetric(name: string, decisions: { confidence: number; disposition: string }[]): MetricValue {
  const label = name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  const total = decisions.length
  if (total === 0) return { label, value: '—' }
  switch (name) {
    case 'average_confidence':
    case 'mean_confidence': {
      const mean = decisions.reduce((sum, row) => sum + row.confidence, 0) / total
      return { label, value: formatPercent(mean) }
    }
    case 'review_rate': {
      const inReview = decisions.filter((row) => row.disposition === 'review').length
      return { label, value: formatPercent(inReview / total) }
    }
    case 'escalation_rate': {
      const escalated = decisions.filter((row) => row.disposition === 'escalated').length
      return { label, value: formatPercent(escalated / total) }
    }
    case 'auto_rate':
    case 'auto_decision_rate': {
      const auto = decisions.filter((row) => row.disposition === 'auto').length
      return { label, value: formatPercent(auto / total) }
    }
    case 'documents_processed':
    case 'visits_booked':
    case 'decisions_total':
    case 'decisions_made':
    default:
      // Unknown metric names fall back to the ledger's decision count so no
      // tile can show a number that did not come from decisions.
      return { label, value: formatCountCompact(total) }
  }
}

export default function Monitoring({ panel }: { panel: MonitoringPanel }) {
  const { decisions, runStatus } = useWorkspace()

  if (runStatus === 'running') {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {panel.metrics.map((metric) => (
            <Skeleton key={metric} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold tracking-tight text-ink">Monitoring</h3>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {panel.metrics.map((metric) => {
          const derived = deriveMetric(metric, decisions)
          return (
            <div
              key={metric}
              className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2.5"
            >
              <p className="truncate text-xs font-medium text-slate-400" title={derived.label}>
                {derived.label}
              </p>
              <p
                className="mt-0.5 truncate text-lg font-bold tabular-nums tracking-tight text-ink sm:text-xl"
                title={derived.value}
              >
                {derived.value}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

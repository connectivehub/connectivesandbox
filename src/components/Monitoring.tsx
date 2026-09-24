// Registry entry for dashboard panel type "monitoring": small metric tiles
// with label, value, and sparkline. BACKEND: metric series come from the
// decisions table in Phase 4; values here are fixtures keyed by metric name.

import type { DashboardPanel } from '@/engine/types'
import { formatCount, trendFromSeed } from '@/lib/format'
import { Skeleton, Sparkline } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type MonitoringPanel = Extract<DashboardPanel, { type: 'monitoring' }>

interface MetricFixture {
  label: string
  value: string
}

const METRIC_FIXTURES: Record<string, MetricFixture> = {
  documents_processed: { label: 'Documents processed', value: formatCount(1284) },
  review_rate: { label: 'Review rate', value: '18%' },
  average_confidence: { label: 'Average confidence', value: '86%' },
  visits_booked: { label: 'Visits booked', value: formatCount(37) },
}

function metricFor(name: string): MetricFixture {
  const known = METRIC_FIXTURES[name]
  if (known) return known
  const label = name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  const seed = trendFromSeed(name, 1)[0] ?? 50
  return { label, value: formatCount(100 + seed * 7) }
}

export default function Monitoring({ panel }: { panel: MonitoringPanel }) {
  const { runStatus } = useWorkspace()

  if (runStatus === 'running') {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {panel.metrics.map((metric) => {
          const fixture = metricFor(metric)
          return (
            <div key={metric} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="truncate text-xs font-medium text-slate-400">{fixture.label}</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-ink">{fixture.value}</p>
              <Sparkline points={trendFromSeed(metric)} className="mt-1 h-7 w-24 text-accent" />
            </div>
          )
        })}
      </div>
    </div>
  )
}

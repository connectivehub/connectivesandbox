// Registry entry for dashboard panel type "usage_counter": runs this month,
// decisions made, estimated minutes saved. Every number traces to the
// decision ledger: the org totals are computed from `decisions` rows by the
// admin-api gateway, and local live runs add this session's decisions rows.

import { useEffect, useState } from 'react'

import type { DashboardPanel } from '@/engine/types'
import { formatCount } from '@/lib/format'
import { Skeleton } from '@/components/ui/Primitives'
import { getOrgUsageTotals, type OrgUsageTotals } from '@/data/adapters/clients'
import { useWorkspace } from '@/state/workspace'

export type UsageCounterPanel = Extract<DashboardPanel, { type: 'usage_counter' }>

// Fixture assumption until session durations exist in the backend.
const MINUTES_SAVED_PER_DECISION = 6

export default function UsageCounter({ panel }: { panel: UsageCounterPanel }) {
  const { decisions, runCount, mode } = useWorkspace()
  const [totals, setTotals] = useState<OrgUsageTotals | null>(null)

  useEffect(() => {
    let active = true
    void getOrgUsageTotals().then((result) => {
      if (active) setTotals(result)
    })
    return () => {
      active = false
    }
  }, [runCount])

  if (!totals) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-44" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    )
  }

  // Only live runs add on top of the ledger totals (preview runs are local
  // fixtures and never write decisions rows).
  const liveDecisions = mode === 'live' ? decisions.length : 0
  const liveRuns = mode === 'live' ? runCount : 0
  const decisionsMade = totals.decisionsMade + liveDecisions
  const stats = [
    { label: 'Runs this month', value: formatCount(totals.runsThisMonth + liveRuns) },
    { label: 'Decisions made', value: formatCount(decisionsMade) },
    {
      label: 'Est. minutes saved',
      value: formatCount(decisionsMade * MINUTES_SAVED_PER_DECISION),
    },
  ]

  return (
    <div className="space-y-2">
      <h3 className="font-semibold tracking-tight text-ink">{panel.label}</h3>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-lg font-bold tracking-tight text-ink">{stat.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

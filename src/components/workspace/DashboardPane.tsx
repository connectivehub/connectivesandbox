// Right dashboard pane: renders the spec's panels in spec order. Panels read
// run data from the workspace context; before the first run every panel shows
// its explicit empty state. Shared by the workspace screen and the admin
// live preview.

import { Suspense } from 'react'
import { ChevronsDownUp } from 'lucide-react'

import { dashboardRegistry } from '@/engine/registry'
import type { DashboardPanel } from '@/engine/types'
import { Card, Eyebrow, Skeleton } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

function PanelSkeleton() {
  return (
    <Card className="space-y-3">
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-16 w-full" />
    </Card>
  )
}

function PanelCard({ panel }: { panel: DashboardPanel }) {
  const Comp = dashboardRegistry[panel.type]
  return (
    <Card className="space-y-3">
      <Suspense fallback={<PanelSkeleton />}>
        <Comp panel={panel} />
      </Suspense>
    </Card>
  )
}

export default function DashboardPane() {
  const { spec, setDashboardExpanded } = useWorkspace()
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Dashboard</Eyebrow>
        <button
          type="button"
          onClick={() => setDashboardExpanded(false)}
          aria-expanded={true}
          aria-label="Collapse dashboard to banner"
          title="Collapse dashboard"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-accent"
        >
          <ChevronsDownUp size={15} aria-hidden="true" />
        </button>
      </div>
      {spec.dashboard.panels.map((panel: DashboardPanel) => (
        <PanelCard key={panel.id} panel={panel} />
      ))}
    </div>
  )
}

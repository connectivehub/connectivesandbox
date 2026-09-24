// Registry entry for dashboard panel type "monitoring". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { DashboardPanel } from '@/engine/types'

export type MonitoringPanel = Extract<DashboardPanel, { type: 'monitoring' }>

export interface MonitoringProps {
  panel: MonitoringPanel
}

export default function Monitoring(_props: MonitoringProps) {
  return (
    <div data-panel="monitoring">
      <p>monitoring panel is not implemented yet (Phase 3).</p>
    </div>
  )
}

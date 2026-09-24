// Registry entry for dashboard panel type "usage_counter". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { DashboardPanel } from '@/engine/types'

export type UsageCounterPanel = Extract<DashboardPanel, { type: 'usage_counter' }>

export interface UsageCounterProps {
  panel: UsageCounterPanel
}

export default function UsageCounter(_props: UsageCounterProps) {
  return (
    <div data-panel="usage_counter">
      <p>usage_counter panel is not implemented yet (Phase 3).</p>
    </div>
  )
}

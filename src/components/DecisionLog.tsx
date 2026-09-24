// Registry entry for dashboard panel type "decision_log". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { DashboardPanel } from '@/engine/types'

export type DecisionLogPanel = Extract<DashboardPanel, { type: 'decision_log' }>

export interface DecisionLogProps {
  panel: DecisionLogPanel
}

export default function DecisionLog(_props: DecisionLogProps) {
  return (
    <div data-panel="decision_log">
      <p>decision_log panel is not implemented yet (Phase 3).</p>
    </div>
  )
}

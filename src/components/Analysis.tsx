// Registry entry for dashboard panel type "analysis". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { DashboardPanel } from '@/engine/types'

export type AnalysisPanel = Extract<DashboardPanel, { type: 'analysis' }>

export interface AnalysisProps {
  panel: AnalysisPanel
}

export default function Analysis(_props: AnalysisProps) {
  return (
    <div data-panel="analysis">
      <p>analysis panel is not implemented yet (Phase 3).</p>
    </div>
  )
}

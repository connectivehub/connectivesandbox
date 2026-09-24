// Registry entry for dashboard panel type "confidence_meter". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { DashboardPanel } from '@/engine/types'

export type ConfidenceMeterPanel = Extract<DashboardPanel, { type: 'confidence_meter' }>

export interface ConfidenceMeterProps {
  panel: ConfidenceMeterPanel
}

export default function ConfidenceMeter(_props: ConfidenceMeterProps) {
  return (
    <div data-panel="confidence_meter">
      <p>confidence_meter panel is not implemented yet (Phase 3).</p>
    </div>
  )
}

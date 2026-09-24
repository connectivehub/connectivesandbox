// Registry entry for intake component type "button_group". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { IntakeComponent } from '@/engine/types'

export type ButtonGroupComponent = Extract<IntakeComponent, { type: 'button_group' }>

export interface ButtonGroupProps {
  component: ButtonGroupComponent
  disabled?: boolean
}

export default function ButtonGroup(_props: ButtonGroupProps) {
  return (
    <div data-intake="button_group">
      <p>button_group intake is not implemented yet (Phase 3).</p>
    </div>
  )
}

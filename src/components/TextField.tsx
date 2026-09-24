// Registry entry for intake component type "text_field". Phase 3 fills in
// behaviour; this phase ships the typed props contract and a placeholder.

import type { IntakeComponent } from '@/engine/types'

export type TextFieldComponent = Extract<IntakeComponent, { type: 'text_field' }>

export interface TextFieldProps {
  component: TextFieldComponent
  disabled?: boolean
}

export default function TextField(_props: TextFieldProps) {
  return (
    <div data-intake="text_field">
      <p>text_field intake is not implemented yet (Phase 3).</p>
    </div>
  )
}

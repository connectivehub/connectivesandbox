// Registry entry for intake component type "form". Phase 3 fills in behaviour;
// this phase ships the typed props contract and a placeholder.

import type { IntakeComponent } from '@/engine/types'

export type FormComponent = Extract<IntakeComponent, { type: 'form' }>

export interface FormProps {
  component: FormComponent
  disabled?: boolean
}

export default function Form(_props: FormProps) {
  return (
    <div data-intake="form">
      <p>form intake is not implemented yet (Phase 3).</p>
    </div>
  )
}

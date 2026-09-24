// Registry entry for intake component type "chat". Phase 3 fills in behaviour
// (via the chat adapter); this phase ships the typed props contract and a
// placeholder.

import type { IntakeComponent } from '@/engine/types'

export type ChatComponent = Extract<IntakeComponent, { type: 'chat' }>

export interface ChatProps {
  component: ChatComponent
  disabled?: boolean
}

export default function Chat(_props: ChatProps) {
  return (
    <div data-intake="chat">
      <p>chat intake is not implemented yet (Phase 3).</p>
    </div>
  )
}

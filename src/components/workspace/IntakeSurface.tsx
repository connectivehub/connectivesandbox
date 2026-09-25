// Left working pane (polish 4): ONE chat flow — everything is the chatbot
// window. Every intake component from the spec renders as an inline
// interactive card inside the flow at the point it occurs (see Chat.tsx);
// there is no separate upload or form surface. A run triggers exactly as
// before: when the intake flow completes (chat send or card submission),
// run-workflow fires and the dashboard/observability banner populates.
// Shared by the workspace screen and the admin live preview, so both mirror
// the same rendering exactly.

import Chat, { type ChatComponent } from '@/components/Chat'
import { useWorkspace } from '@/state/workspace'

function IntakeHeader({ spec }: { spec: { name: string; description: string } }) {
  return (
    <div className="shrink-0">
      <h2 className="text-lg font-bold tracking-tight text-ink">{spec.name}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{spec.description}</p>
    </div>
  )
}

export default function IntakeSurface() {
  const { spec } = useWorkspace()
  const chat = spec.intake.components.find(
    (component): component is ChatComponent => component.type === 'chat',
  )

  // One chat flow, viewport-locked: header, then the chat filling what
  // remains. No vertical growth from chat content; the message list is the
  // only inner scroll.
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <IntakeHeader spec={spec} />
      <section aria-label="Chat" className="flex min-h-0 flex-1 flex-col">
        <Chat component={chat ?? null} />
      </section>
    </div>
  )
}

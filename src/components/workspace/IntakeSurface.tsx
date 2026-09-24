// Left working pane: renders the spec's intake components in spec order.
// Chat-first specs lock to the viewport: the chat card fills the remaining
// height, message list is the only inner scroll. Form-style intakes end in a
// single Submit action — submitting the intake IS the run. Shared by the
// workspace screen and the admin live preview.

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'

import { intakeRegistry } from '@/engine/registry'
import type { IntakeComponent } from '@/engine/types'
import { useWorkspace } from '@/state/workspace'
import { Card, Skeleton } from '@/components/ui/Primitives'

function IntakeSkeleton() {
  return (
    <Card className="space-y-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-24 w-full" />
    </Card>
  )
}

export function IntakeCard({ component }: { component: IntakeComponent }) {
  const Comp = intakeRegistry[component.type]
  return (
    <Suspense fallback={<IntakeSkeleton />}>
      <Comp component={component} />
    </Suspense>
  )
}

const typeLabels: Record<IntakeComponent['type'], string> = {
  file_upload: 'File upload',
  chat: 'Conversation',
  button_group: 'Options',
  text_field: 'Text input',
  form: 'Form',
}

function sectionLabel(component: IntakeComponent): string {
  return 'label' in component ? component.label : typeLabels[component.type]
}

function IntakeHeader({ spec }: { spec: { name: string; description: string } }) {
  return (
    <div className="shrink-0">
      <h2 className="text-lg font-bold tracking-tight text-ink">{spec.name}</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{spec.description}</p>
    </div>
  )
}

/** Submit action for intakes without a chat composer: submitting IS the run. */
function SubmitAction() {
  const { intakeComplete, runStatus, run } = useWorkspace()
  const running = runStatus === 'running'
  return (
    <div className="flex shrink-0 justify-end">
      <button
        type="button"
        onClick={run}
        disabled={!intakeComplete || running}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover active:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
        {running ? 'Judging…' : 'Submit'}
      </button>
    </div>
  )
}

export default function IntakeSurface() {
  const { spec } = useWorkspace()
  const chat = spec.intake.components.find((component) => component.type === 'chat')
  const others = spec.intake.components.filter((component) => component.type !== 'chat')

  // Chat-first spec: fixed-height composition — header, secondary components,
  // then the chat filling what remains. No vertical growth from chat content.
  if (chat !== undefined) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4">
        <IntakeHeader spec={spec} />
        {others.map((component) => (
          <section key={component.id} aria-label={sectionLabel(component)} className="shrink-0">
            <IntakeCard component={component} />
          </section>
        ))}
        <section aria-label={sectionLabel(chat)} className="flex min-h-0 flex-1 flex-col">
          <IntakeCard component={chat} />
        </section>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <IntakeHeader spec={spec} />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 scroll-slim">
        {spec.intake.components.map((component) => (
          <section key={component.id} aria-label={sectionLabel(component)}>
            <IntakeCard component={component} />
          </section>
        ))}
      </div>
      <SubmitAction />
    </div>
  )
}

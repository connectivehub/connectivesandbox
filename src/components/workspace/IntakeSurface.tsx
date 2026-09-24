// Left working pane: renders the spec's intake components in spec order, plus
// the Run Workflow action that drives the pure runner through the fixture
// judge adapter. Shared by the workspace screen and the admin live preview.

import { Suspense } from 'react'

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

export default function IntakeSurface() {
  const { spec } = useWorkspace()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-prose">
          <h2 className="text-lg font-bold tracking-tight text-ink">{spec.name}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{spec.description}</p>
        </div>
      </div>

      {spec.intake.components.map((component) => (
        <section key={component.id} aria-label={sectionLabel(component)}>
          <IntakeCard component={component} />
        </section>
      ))}
    </div>
  )
}

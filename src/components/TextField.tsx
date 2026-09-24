// Registry entry for intake component type "text_field": single-line input or
// multiline textarea. Value lands in the workspace intake state as a string.

import type { IntakeComponent } from '@/engine/types'
import { Card, Eyebrow } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type TextFieldComponent = Extract<IntakeComponent, { type: 'text_field' }>

export default function TextField({ component }: { component: TextFieldComponent }) {
  const { getIntakeValue, setIntakeValue, runStatus } = useWorkspace()
  const value = (getIntakeValue(component.id) as string | undefined) ?? ''
  const disabled = runStatus === 'running'

  return (
    <Card className="space-y-4">
      <div>
        <Eyebrow>Input</Eyebrow>
        <h3 className="mt-1 font-semibold tracking-tight text-ink">{component.label}</h3>
      </div>
      {component.multiline ? (
        <textarea
          value={value}
          onChange={(event) => setIntakeValue(component.id, event.target.value)}
          disabled={disabled}
          rows={4}
          placeholder="Type here…"
          aria-label={component.label}
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none disabled:opacity-50"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => setIntakeValue(component.id, event.target.value)}
          disabled={disabled}
          placeholder="Type here…"
          aria-label={component.label}
          className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none disabled:opacity-50"
        />
      )}
    </Card>
  )
}

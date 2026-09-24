// Registry entry for intake component type "form": labelled field stack with
// text, textarea, and select fields. Values land in the workspace intake
// state as Record<fieldId, string> under the form component id.

import type { IntakeComponent } from '@/engine/types'
import { Card, Eyebrow } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type FormComponent = Extract<IntakeComponent, { type: 'form' }>

const controlClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none disabled:opacity-50'

export default function Form({ component }: { component: FormComponent }) {
  const { getIntakeValue, setIntakeValue, runStatus } = useWorkspace()
  const values = (getIntakeValue(component.id) as Record<string, string> | undefined) ?? {}
  const disabled = runStatus === 'running'

  const setValue = (fieldId: string, value: string) => {
    setIntakeValue(component.id, { ...values, [fieldId]: value })
  }

  return (
    <Card className="space-y-4">
      <div>
        <Eyebrow>Details</Eyebrow>
        <h3 className="mt-1 font-semibold tracking-tight text-ink">Job details</h3>
      </div>
      <div className="space-y-4">
        {component.fields.map((field) => (
          <div key={field.id}>
            <label
              htmlFor={`field-${component.id}-${field.id}`}
              className="mb-1.5 block text-sm font-medium text-slate-600"
            >
              {field.label}
              {field.required === true && (
                <span aria-hidden="true" className="ml-0.5 text-accent">
                  *
                </span>
              )}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`field-${component.id}-${field.id}`}
                value={values[field.id] ?? ''}
                onChange={(event) => setValue(field.id, event.target.value)}
                disabled={disabled}
                rows={3}
                placeholder="Type here…"
                className={`${controlClass} resize-y leading-relaxed`}
              />
            ) : field.type === 'select' ? (
              <select
                id={`field-${component.id}-${field.id}`}
                value={values[field.id] ?? ''}
                onChange={(event) => setValue(field.id, event.target.value)}
                disabled={disabled}
                className={controlClass}
              >
                <option value="">Select…</option>
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`field-${component.id}-${field.id}`}
                value={values[field.id] ?? ''}
                onChange={(event) => setValue(field.id, event.target.value)}
                disabled={disabled}
                placeholder="Type here…"
                className={controlClass}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        <span aria-hidden="true" className="text-accent">
          *
        </span>{' '}
        Required
      </p>
    </Card>
  )
}

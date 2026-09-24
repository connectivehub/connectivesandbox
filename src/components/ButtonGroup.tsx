// Registry entry for intake component type "button_group": segmented control
// with single- and multi-select modes. Selection lands in the workspace
// intake state as a string (single) or string[] (multi).

import type { IntakeComponent } from '@/engine/types'
import { cn } from '@/lib/utils'
import { Card, Eyebrow } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type ButtonGroupComponent = Extract<IntakeComponent, { type: 'button_group' }>

export default function ButtonGroup({ component }: { component: ButtonGroupComponent }) {
  const { getIntakeValue, setIntakeValue, runStatus } = useWorkspace()
  const disabled = runStatus === 'running'
  const selected = getIntakeValue(component.id)

  const isSelected = (value: string): boolean => {
    if (component.multi) return Array.isArray(selected) && selected.includes(value)
    return selected === value
  }

  const toggle = (value: string) => {
    if (disabled) return
    if (component.multi) {
      const current = Array.isArray(selected) ? selected : []
      setIntakeValue(
        component.id,
        current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
      )
    } else {
      setIntakeValue(component.id, selected === value ? undefined : value)
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <Eyebrow>Select</Eyebrow>
        <h3 className="mt-1 font-semibold tracking-tight text-ink">{component.label}</h3>
      </div>
      <div
        role="group"
        aria-label={component.label}
        className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-slate-50 p-1"
      >
        {component.options.map((option) => {
          const active = isSelected(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              disabled={disabled}
              aria-pressed={active}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-ink',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <p className="text-sm text-slate-400">
        {component.multi ? 'Select every option that applies.' : 'Select one option.'}
      </p>
    </Card>
  )
}

// Collapsible sidebar rail: collapsed to a slim icon column by default,
// expands on hover as an overlay flyout (no reflow push), click pins it open
// in-flow. The pin button is the keyboard/tap toggle — nothing depends on
// hover alone.

import { useState, type ReactNode } from 'react'
import { Pin, PinOff } from 'lucide-react'

import { cn } from '@/lib/utils'

export const RAIL_W = 56

export function CollapsibleRail({
  width,
  label,
  rail,
  children,
  className,
}: {
  width: number
  label: string
  rail: ReactNode
  children: ReactNode
  className?: string
}) {
  const [pinned, setPinned] = useState(false)
  const [hovered, setHovered] = useState(false)
  const open = pinned || hovered

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: pinned ? width : RAIL_W }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {!open && (
        <div className="flex h-full flex-col items-center justify-between py-3">
          <div className="flex flex-col items-center gap-2">{rail}</div>
          <button
            type="button"
            onClick={() => setPinned(true)}
            aria-label={`Pin ${label} open`}
            aria-expanded={false}
            title={`Pin ${label} open`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-accent"
          >
            <Pin size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {open && (
        <div
          className={cn(
            'flex h-full flex-col',
            pinned
              ? ''
              : 'absolute inset-y-0 left-0 z-30 border-r border-slate-200 bg-slate-50 shadow-lg',
          )}
          style={{ width }}
        >
          {children}
          <button
            type="button"
            onClick={() => {
              setPinned(false)
              setHovered(false)
            }}
            aria-label={`Collapse ${label}`}
            aria-expanded={true}
            title={`Collapse ${label}`}
            className={cn(
              'absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-accent',
              pinned ? '' : 'bg-slate-50/90',
            )}
          >
            <PinOff size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

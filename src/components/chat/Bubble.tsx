// Shared WhatsApp-style chat pieces (polish 3): bubbles with subtle tails,
// in-bubble timestamps with slate double ticks, and sparse centred date
// separators. Brand law: slate neutrals, orange wash for own messages (never
// WhatsApp green), system fonts, no emoji.

import type { ReactNode } from 'react'
import { Check, CheckCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

const dayFormat = new Intl.DateTimeFormat('en-SG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const timeFormat = new Intl.DateTimeFormat('en-SG', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: false,
})

function dayKey(iso: string): string {
  return new Date(iso).toDateString()
}

/** Sparse centred separator label: TODAY, YESTERDAY, else a short date. */
export function dayLabel(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dayFormat.format(date).toUpperCase()
}

export function timeLabel(iso: string): string {
  return timeFormat.format(new Date(iso))
}

/** True when this message's day differs from the previous one's. */
export function isNewDay(previousAt: string | undefined, at: string): boolean {
  return previousAt === undefined || dayKey(previousAt) !== dayKey(at)
}

export function DaySeparator({ iso }: { iso: string }) {
  return (
    <div className="flex justify-center" role="separator" aria-label={dayLabel(iso)}>
      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {dayLabel(iso)}
      </span>
    </div>
  )
}

/**
 * One chat bubble. Own (user) messages sit right in an orange-tinted wash
 * with a tail; incoming/model messages sit left in white. Timestamp lives
 * inside the bubble, small, bottom-right; outgoing messages carry
 * delivered-style ticks in slate (status colour, never accent).
 */
export function Bubble({
  role,
  at,
  sending,
  children,
}: {
  role: 'user' | 'assistant'
  at: string
  sending?: boolean
  children: ReactNode
}) {
  const outgoing = role === 'user'
  return (
    <div className={cn('flex', outgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm',
          outgoing
            ? 'bubble-tail-out rounded-tr-none bg-accent-wash text-ink'
            : 'bubble-tail-in rounded-tl-none border border-slate-100 bg-white text-slate-600',
        )}
      >
        {children}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] leading-none text-slate-400">
          <time className="whitespace-nowrap">{timeLabel(at)}</time>
          {outgoing &&
            (sending ? (
              <Check size={11} aria-hidden="true" className="shrink-0" />
            ) : (
              <CheckCheck size={11} aria-hidden="true" className="shrink-0" />
            ))}
        </div>
      </div>
    </div>
  )
}

// Registry entry for dashboard panel type "decision_log": reverse-
// chronological table of time, question, answer, confidence, and latency.
// Rows come from the workspace context: local judge runs on fixtures now,
// BACKEND: the decisions table from Phase 4.

import type { DashboardPanel } from '@/engine/types'
import { formatAnswerValue, formatPercent, formatTime } from '@/lib/format'
import { Skeleton } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type DecisionLogPanel = Extract<DashboardPanel, { type: 'decision_log' }>

const dotTone: Record<string, string> = {
  auto: 'bg-emerald-500',
  review: 'bg-amber-500',
  escalated: 'bg-red-500',
}

export default function DecisionLog({ panel }: { panel: DecisionLogPanel }) {
  const { decisions, runStatus } = useWorkspace()
  const rows = decisions.slice(0, panel.limit)

  if (runStatus === 'running') {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold tracking-tight text-ink">Decision log</h3>
        <p className="text-sm text-slate-400">
          No decisions recorded yet — run the workflow and every judge verdict lands here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold tracking-tight text-ink">Decision log</h3>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400">
              <th scope="col" className="px-2 py-2 font-medium">Time</th>
              <th scope="col" className="px-2 py-2 font-medium">Question</th>
              <th scope="col" className="px-2 py-2 font-medium">Answer</th>
              <th scope="col" className="px-2 py-2 font-medium">Confidence</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                  {formatTime(row.created_at)}
                </td>
                <td className="px-2 py-2 text-slate-600">{row.question}</td>
                <td className="px-2 py-2 font-medium text-ink">
                  {formatAnswerValue(row.answer)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-600">
                  <span
                    aria-hidden="true"
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${dotTone[row.disposition] ?? 'bg-slate-300'}`}
                  />
                  {formatPercent(row.confidence)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right text-slate-400">
                  {row.latency_ms !== undefined ? `${row.latency_ms} ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

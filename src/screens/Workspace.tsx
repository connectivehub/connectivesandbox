// Client workspace: ink top bar, 220px read-only workflow sidebar, and a
// two-pane main area — 60% working surface (intake, spec order) and 40%
// dashboard (panels, spec order). Below tablet the panes stack with the
// dashboard first. One WorkspaceProvider wraps both panes so intake values
// and judge results are shared.

import { useEffect, useState } from 'react'

import AppTopBar from '@/components/AppTopBar'
import DashboardPane from '@/components/workspace/DashboardPane'
import IntakeSurface from '@/components/workspace/IntakeSurface'
import { Eyebrow } from '@/components/ui/Primitives'
import { getWorkflowSpec, listWorkflows } from '@/data/adapters/workflows'
import type { WorkflowSummary } from '@/data/types'
import type { WorkflowSpec } from '@/engine/types'
import { WorkspaceProvider } from '@/state/workspace'
import { cn } from '@/lib/utils'

export default function Workspace() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [spec, setSpec] = useState<WorkflowSpec | null>(null)

  useEffect(() => {
    let active = true
    void listWorkflows().then((summaries) => {
      if (!active) return
      setWorkflows(summaries)
      setSelectedId((current) => current ?? summaries[0]?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    if (selectedId === null) {
      setSpec(null)
      return
    }
    void getWorkflowSpec(selectedId).then((loaded) => {
      if (active) setSpec(loaded)
    })
    return () => {
      active = false
    }
  }, [selectedId])

  return (
    <div className="flex h-screen flex-col bg-white">
      <AppTopBar context="Workspace" />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[220px] shrink-0 flex-col gap-2 border-r border-slate-200 bg-slate-50 px-3 py-4 md:flex">
          <Eyebrow className="px-2">Workflows</Eyebrow>
          <nav aria-label="Provisioned workflows" className="space-y-1">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelectedId(workflow.id)}
                aria-current={workflow.id === selectedId ? 'page' : undefined}
                className={cn(
                  'block w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                  workflow.id === selectedId
                    ? 'bg-white text-ink shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-white/60 hover:text-ink',
                )}
              >
                <span
                  className={cn(
                    'block truncate text-sm font-medium',
                    workflow.id === selectedId && 'text-accent',
                  )}
                >
                  {workflow.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400">
                  v{workflow.version}
                </span>
              </button>
            ))}
          </nav>
          <p className="mt-auto px-2 text-xs leading-relaxed text-slate-400">
            Workflows are provisioned by your administrator and read-only here.
          </p>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {workflows.length > 1 && (
            <div className="border-b border-slate-200 px-4 py-2 md:hidden">
              <label htmlFor="workflow-switcher" className="sr-only">
                Choose workflow
              </label>
              <select
                id="workflow-switcher"
                value={selectedId ?? ''}
                onChange={(event) => setSelectedId(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {spec !== null && selectedId !== null ? (
            <WorkspaceProvider key={spec.name} workflowId={selectedId} spec={spec}>
              <section
                aria-label="Working surface"
                className="order-2 min-h-0 overflow-y-auto px-6 py-6 lg:order-1 lg:w-[60%] lg:shrink-0"
              >
                <IntakeSurface />
              </section>
              <section
                aria-label="Dashboard"
                className="order-1 min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 px-6 py-6 lg:order-2 lg:w-[40%] lg:shrink-0 lg:border-l lg:border-t-0"
              >
                <DashboardPane />
              </section>
            </WorkspaceProvider>
          ) : (
            <p className="px-6 py-6 text-sm text-slate-400">Loading workflow…</p>
          )}
        </div>
      </div>
    </div>
  )
}

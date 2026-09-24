// Admin console: three columns — client list (260px), workflow-builder chat
// (flex), and a 480px live preview column with raw-JSON editing, validation
// status, and Publish. The builder chat runs on fixtures this phase; the
// preview renders a loaded spec exactly as the workspace does.

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Send } from 'lucide-react'

import AppTopBar from '@/components/AppTopBar'
import DashboardPane from '@/components/workspace/DashboardPane'
import IntakeSurface from '@/components/workspace/IntakeSurface'
import { Badge, Eyebrow, PrimaryButton } from '@/components/ui/Primitives'
import { safeParseWorkflowSpec } from '@/engine/schema'
import type { WorkflowSpec } from '@/engine/types'
import { getClientAccessCode, listClients } from '@/data/adapters/clients'
import { getWorkflowSpec, listWorkflows } from '@/data/adapters/workflows'
import type { Client, WorkflowSummary } from '@/data/types'
import {
  builderAckReply,
  builderConversation,
  type BuilderChatMessage,
} from '@/data/fixtures/builderChat'
import { WorkspaceProvider } from '@/state/workspace'
import { cn } from '@/lib/utils'

type SpecValidation =
  | { state: 'empty' }
  | { state: 'invalid'; error: string }
  | { state: 'valid'; spec: WorkflowSpec }

function formatZodError(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid workflow spec.'
  const path = issue.path.map(String).join('.')
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message
}

// Scaled-down two-pane preview frame: laid out at 600x620, scaled to 72%.
const FRAME_W = 600
const FRAME_H = 620
const SCALE = 0.72

/** Collapsed JSON block labelled "Workflow spec" with a load action. */
function SpecBlock({ spec, onLoad }: { spec: WorkflowSpec; onLoad: (spec: WorkflowSpec) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 rounded-xl border border-slate-200">
      <div className="flex items-center justify-between gap-2 rounded-t-xl bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-400"
        >
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn('shrink-0 transition-transform', open && 'rotate-180')}
          />
          <span className="truncate">Workflow spec</span>
        </button>
        <button
          type="button"
          onClick={() => onLoad(spec)}
          className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover active:bg-accent-pressed"
        >
          Load into preview
        </button>
      </div>
      {open && (
        <pre className="max-h-56 overflow-auto rounded-b-xl bg-surface-dark p-3 font-mono text-xs leading-relaxed text-slate-200">
          {JSON.stringify(spec, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function Admin() {
  const [clients, setClients] = useState<Client[]>([])
  const [accessCodes, setAccessCodes] = useState<Record<string, string>>({})
  const [workflowCounts, setWorkflowCounts] = useState<Record<string, number>>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null)

  const [messages, setMessages] = useState<BuilderChatMessage[]>(builderConversation)
  const [draft, setDraft] = useState('')
  const [chatPending, setChatPending] = useState(false)

  const [tab, setTab] = useState<'preview' | 'json'>('preview')
  const [specSource, setSpecSource] = useState('')
  const [publishedMessage, setPublishedMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listClients().then(async (rows) => {
      const codeEntries = await Promise.all(
        rows.map(async (client) => [client.id, await getClientAccessCode(client.id)] as const),
      )
      const countEntries = await Promise.all(
        rows.map(async (client) => [client.id, (await listWorkflows(client.id)).length] as const),
      )
      if (!active) return
      setClients(rows)
      setAccessCodes(
        Object.fromEntries(codeEntries.filter((entry): entry is readonly [string, string] => entry[1] !== null)),
      )
      setWorkflowCounts(Object.fromEntries(countEntries))
      setSelectedClientId(rows[0]?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    if (selectedClientId === null) {
      setWorkflows([])
      setSelectedWorkflowId(null)
      return
    }
    void listWorkflows(selectedClientId).then((rows) => {
      if (!active) return
      setWorkflows(rows)
      setSelectedWorkflowId(rows[0]?.id ?? null)
    })
    return () => {
      active = false
    }
  }, [selectedClientId])

  // Selecting a workflow loads its stored spec into the editor and preview.
  useEffect(() => {
    let active = true
    if (selectedWorkflowId === null) return
    void getWorkflowSpec(selectedWorkflowId).then((loaded) => {
      if (active && loaded) setSpecSource(JSON.stringify(loaded, null, 2))
    })
    return () => {
      active = false
    }
  }, [selectedWorkflowId])

  const validation = useMemo<SpecValidation>(() => {
    const source = specSource.trim()
    if (source.length === 0) return { state: 'empty' }
    let parsed: unknown
    try {
      parsed = JSON.parse(source)
    } catch (error) {
      return { state: 'invalid', error: `Invalid JSON — ${(error as Error).message}` }
    }
    const result = safeParseWorkflowSpec(parsed)
    return result.success
      ? { state: 'valid', spec: result.data }
      : { state: 'invalid', error: formatZodError(result.error) }
  }, [specSource])

  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null

  const addClient = () => {
    const id = `clt_local_${Date.now()}`
    const client: Client = {
      id,
      name: 'New Organisation',
      slug: `new-org-${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    setClients((previous) => [...previous, client])
    setAccessCodes((previous) => ({
      ...previous,
      [id]: String(Math.floor(1000 + Math.random() * 9000)),
    }))
    setWorkflowCounts((previous) => ({ ...previous, [id]: 0 }))
    setSelectedClientId(id)
  }

  const loadSpecIntoPreview = (spec: WorkflowSpec) => {
    setSpecSource(JSON.stringify(spec, null, 2))
    setTab('preview')
  }

  const sendChat = () => {
    const content = draft.trim()
    if (content.length === 0 || chatPending) return
    setDraft('')
    setMessages((previous) => [
      ...previous,
      { id: `bc_${Date.now()}`, role: 'user', content },
    ])
    setChatPending(true)
    window.setTimeout(() => {
      setChatPending(false)
      setMessages((previous) => [
        ...previous,
        { id: `bc_${Date.now()}_ack`, role: 'assistant', content: builderAckReply },
      ])
    }, 900)
  }

  const publish = () => {
    if (validation.state !== 'valid' || !selectedClient) return
    const version = selectedWorkflow?.version ?? 1
    setPublishedMessage(`Published “${validation.spec.name}” to ${selectedClient.name} — v${version + 1}`)
    window.setTimeout(() => setPublishedMessage(null), 4000)
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      <AppTopBar context="Admin" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Left column: clients and their workflows */}
        <aside className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-4 lg:w-[260px] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-2 px-2">
            <Eyebrow>Clients</Eyebrow>
            <button
              type="button"
              onClick={addClient}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent-hover active:bg-accent-pressed"
            >
              New Client
            </button>
          </div>
          <div className="mt-3 space-y-1">
            {clients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                aria-current={client.id === selectedClientId ? 'true' : undefined}
                className={cn(
                  'block w-full rounded-lg px-3 py-2.5 text-left transition-colors',
                  client.id === selectedClientId
                    ? 'bg-white text-ink shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-white/60 hover:text-ink',
                )}
              >
                <span className="block truncate text-sm font-medium">{client.name}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono">#{accessCodes[client.id] ?? '····'}</span>
                  <span>
                    {workflowCounts[client.id] ?? 0}{' '}
                    {(workflowCounts[client.id] ?? 0) === 1 ? 'workflow' : 'workflows'}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <Eyebrow className="mt-6 px-2">Workflows</Eyebrow>
          <div className="mt-3 space-y-1">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                onClick={() => setSelectedWorkflowId(workflow.id)}
                aria-current={workflow.id === selectedWorkflowId ? 'true' : undefined}
                className={cn(
                  'block w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                  workflow.id === selectedWorkflowId
                    ? 'bg-white font-medium text-accent shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-white/60 hover:text-ink',
                )}
              >
                <span className="block truncate">{workflow.name}</span>
                <span className="mt-0.5 block text-xs text-slate-400">v{workflow.version}</span>
              </button>
            ))}
            {workflows.length === 0 && (
              <p className="px-3 text-xs text-slate-400">
                No workflows for this client yet — build one in the chat.
              </p>
            )}
          </div>
        </aside>

        {/* Centre column: workflow-builder chat */}
        <main className="flex min-h-[480px] min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-2.5">
            <p className="truncate text-sm">
              <span className="font-semibold text-ink">{selectedClient?.name ?? 'No client selected'}</span>
              <span className="text-slate-400"> · {selectedWorkflow?.name ?? 'New workflow'}</span>
            </p>
            {validation.state === 'valid' && <Badge tone="valid">Spec valid</Badge>}
            {validation.state === 'invalid' && specSource.trim().length > 0 && (
              <Badge tone="invalid">Spec invalid</Badge>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-label="Builder chat">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    message.role === 'user'
                      ? 'bg-accent-tint text-ink'
                      : 'border border-slate-200 bg-white text-slate-600',
                  )}
                >
                  {message.content}
                  {message.spec !== undefined && (
                    <SpecBlock spec={message.spec} onLoad={loadSpecIntoPreview} />
                  )}
                </div>
              </div>
            ))}
            {chatPending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
                  <span aria-hidden="true" className="animate-pulse font-semibold text-accent">
                    ▍
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-slate-200 px-5 py-3"
            onSubmit={(event) => {
              event.preventDefault()
              sendChat()
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe the workflow you need…"
              aria-label="Message the builder"
              disabled={chatPending}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={chatPending || draft.trim().length === 0}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-40"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </main>

        {/* Right column: live preview, raw JSON, validation, publish */}
        <aside className="flex shrink-0 flex-col border-t border-slate-200 bg-slate-50 px-4 py-4 lg:w-[480px] lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1">
              {(['preview', 'json'] as const).map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setTab(entry)}
                  aria-pressed={tab === entry}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    tab === entry
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-slate-600 hover:text-ink',
                  )}
                >
                  {entry === 'preview' ? 'Preview' : 'Raw JSON'}
                </button>
              ))}
            </div>
            {validation.state === 'valid' ? (
              <Badge tone="valid">valid</Badge>
            ) : validation.state === 'invalid' ? (
              <Badge tone="invalid">invalid</Badge>
            ) : (
              <Badge tone="neutral">no spec</Badge>
            )}
          </div>

          {tab === 'preview' ? (
            <div className="mt-4">
              <div
                className="relative"
                style={{ width: FRAME_W * SCALE, height: FRAME_H * SCALE }}
              >
                <div
                  className="absolute left-0 top-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  style={{
                    width: FRAME_W,
                    height: FRAME_H,
                    transform: `scale(${SCALE})`,
                    transformOrigin: 'top left',
                  }}
                >
                  {validation.state === 'valid' ? (
                    <WorkspaceProvider
                      key={validation.spec.name}
                      workflowId={selectedWorkflowId ?? 'preview'}
                      spec={validation.spec}
                    >
                      <div className="flex h-full flex-col">
                        <p className="shrink-0 border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                          {validation.spec.name}
                        </p>
                        <div className="flex min-h-0 flex-1">
                          <div className="w-[60%] shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-4">
                            <IntakeSurface />
                          </div>
                          <div className="w-[40%] shrink-0 overflow-y-auto bg-slate-50 px-4 py-4">
                            <DashboardPane />
                          </div>
                        </div>
                      </div>
                    </WorkspaceProvider>
                  ) : (
                    <div className="flex h-full items-center justify-center p-8 text-center">
                      <p className="text-sm leading-relaxed text-slate-400">
                        No valid workflow spec loaded. Select a workflow on the left, or load a
                        spec from the builder chat.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <textarea
              value={specSource}
              onChange={(event) => setSpecSource(event.target.value)}
              spellCheck={false}
              aria-label="Workflow spec JSON"
              className="mt-4 h-[420px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-ink focus:border-accent focus:outline-none"
              placeholder="Load or paste a WorkflowSpec JSON here."
            />
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
            {validation.state === 'valid' ? (
              <p className="text-sm text-slate-600">
                Schema check passed — the spec is ready to publish.
              </p>
            ) : validation.state === 'invalid' ? (
              <p className="break-words font-mono text-xs leading-relaxed text-red-600">
                {validation.error}
              </p>
            ) : (
              <p className="text-sm text-slate-400">Load a spec to validate and publish.</p>
            )}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <PrimaryButton
              onClick={publish}
              disabled={validation.state !== 'valid'}
              className="w-full"
            >
              Publish to Client
            </PrimaryButton>
          </div>
          {publishedMessage !== null && (
            <p role="status" className="mt-2 text-xs font-medium text-emerald-700">
              {publishedMessage}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

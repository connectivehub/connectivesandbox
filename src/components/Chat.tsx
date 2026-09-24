// Registry entry for intake component type "chat": message list with the
// spec's opening message, streaming-cursor typing state, and input. The
// assistant reply is a fixture echo — BACKEND: assistant replies come from
// the chat edge function from Phase 4.

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import type { IntakeComponent } from '@/engine/types'
import { cn } from '@/lib/utils'
import { Card, Eyebrow } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type ChatComponent = Extract<IntakeComponent, { type: 'chat' }>

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const FIXTURE_REPLY =
  'Thanks — I have added that to the job details. Once your photos are in, run the workflow and the judges will triage it.'

export default function Chat({ component }: { component: ChatComponent }) {
  const { runStatus } = useWorkspace()
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: 'opening', role: 'assistant', content: component.opening_message },
  ])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [typing, setTyping] = useState<{ messageId: string; full: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const disabled = runStatus === 'running' || pending

  // Type out the fixture reply character by character, cursor at the end.
  useEffect(() => {
    if (!typing) return
    let index = 0
    const timer = window.setInterval(() => {
      index += 2
      const slice = typing.full.slice(0, index)
      setMessages((previous) =>
        previous.map((message) =>
          message.id === typing.messageId ? { ...message, content: slice } : message,
        ),
      )
      if (index >= typing.full.length) {
        window.clearInterval(timer)
        setTyping(null)
      }
    }, 24)
    return () => window.clearInterval(timer)
  }, [typing])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const send = () => {
    const content = draft.trim()
    if (content.length === 0 || disabled) return
    setDraft('')
    const replyId = `msg_${Date.now()}_reply`
    setMessages((previous) => [
      ...previous,
      { id: `msg_${Date.now()}`, role: 'user', content },
      { id: replyId, role: 'assistant', content: '' },
    ])
    setPending(true)
    window.setTimeout(() => {
      setPending(false)
      setTyping({ messageId: replyId, full: FIXTURE_REPLY })
    }, 900)
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <Eyebrow>Conversation</Eyebrow>
        <h3 className="mt-1 font-semibold tracking-tight text-ink">Intake chat</h3>
      </div>

      {messages.length <= 1 ? (
        <p className="text-sm text-slate-400">No messages yet — say hello below.</p>
      ) : null}

      <div ref={scrollRef} className="max-h-72 min-h-24 space-y-3 overflow-y-auto pr-1">
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
              {(typing?.messageId === message.id || (pending && message.role === 'assistant')) && (
                <span aria-hidden="true" className="ml-0.5 animate-pulse font-semibold text-accent">
                  ▍
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={component.placeholder}
          disabled={disabled}
          aria-label="Message"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-40"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </Card>
  )
}

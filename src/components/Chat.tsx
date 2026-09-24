// Registry entry for intake component type "chat": message list with the
// spec's opening message, streaming-cursor typing state, and input. Files can
// be dragged anywhere onto the panel or attached via the clip control; they
// wait as preview chips and travel with the sent message. The assistant reply
// is a fixture echo — BACKEND: assistant replies come from the chat edge
// function from Phase 4.

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'

import type { IntakeComponent } from '@/engine/types'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { Card } from '@/components/ui/Primitives'
import { useWorkspace } from '@/state/workspace'

export type ChatComponent = Extract<IntakeComponent, { type: 'chat' }>

interface ChatAttachment {
  id: string
  name: string
  size: number
  url: string | null
}

interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: { name: string; url: string | null }[]
}

const FIXTURE_REPLY = 'Noted — added to the job details.'

export default function Chat({ component }: { component: ChatComponent }) {
  const { runStatus, run } = useWorkspace()
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: 'opening', role: 'assistant', content: component.opening_message },
  ])
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [typing, setTyping] = useState<{ messageId: string; full: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  }, [messages, attachments])

  const addFiles = (files: FileList | File[]) => {
    const next = Array.from(files).map<ChatAttachment>((file) => ({
      id: `att_${Date.now()}_${file.name}`,
      name: file.name,
      size: file.size,
      url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setAttachments((previous) => [...previous, ...next])
  }

  const removeAttachment = (id: string) => {
    setAttachments((previous) => {
      const target = previous.find((entry) => entry.id === id)
      if (target?.url) URL.revokeObjectURL(target.url)
      return previous.filter((entry) => entry.id !== id)
    })
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (!disabled && event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files)
  }

  const send = () => {
    const content = draft.trim()
    if (content.length === 0 || disabled) return
    setDraft('')
    const sent = attachments.map(({ name, url }) => ({ name, url }))
    attachments.forEach((entry) => entry.url !== null && URL.revokeObjectURL(entry.url))
    setAttachments([])
    const replyId = `msg_${Date.now()}_reply`
    setMessages((previous) => [
      ...previous,
      { id: `msg_${Date.now()}`, role: 'user', content, attachments: sent.length > 0 ? sent : undefined },
      { id: replyId, role: 'assistant', content: '' },
    ])
    setPending(true)
    // Submitting the intake IS the run — the message (with attachments)
    // triggers the judgment pass; results populate the dashboard/banner.
    run()
    window.setTimeout(() => {
      setPending(false)
      setTyping({ messageId: replyId, full: FIXTURE_REPLY })
    }, 900)
  }

  return (
    <Card
      className="relative flex flex-col gap-4"
      onDragEnter={(event) => {
        event.preventDefault()
        dragDepth.current += 1
        if (!disabled) setDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-accent-tint"
        >
          <p className="text-sm font-semibold text-accent">Drop photos here</p>
        </div>
      )}

      <div ref={scrollRef} className="scroll-slim max-h-72 min-h-24 space-y-3 overflow-y-auto pr-1">
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
              {message.attachments !== undefined && message.attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {message.attachments.map((attachment) =>
                    attachment.url !== null ? (
                      <img
                        key={attachment.name}
                        src={attachment.url}
                        alt={attachment.name}
                        className="h-14 w-14 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <span
                        key={attachment.name}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-400"
                      >
                        {attachment.name}
                      </span>
                    ),
                  )}
                </div>
              )}
              {message.content}
              {(typing?.messageId === message.id || (pending && message.role === 'assistant')) && (
                <span aria-hidden="true" className="ml-0.5 animate-pulse font-semibold text-accent">
                  ▍
                </span>
              )}
            </div>
          </div>
        ))}
        {messages.length <= 1 && (
          <p className="text-sm text-slate-400">Drop photos here.</p>
        )}
      </div>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Attachments to send">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 pr-2"
            >
              {attachment.url !== null ? (
                <img
                  src={attachment.url}
                  alt=""
                  className="h-8 w-8 rounded-md border border-slate-200 object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="h-8 w-8 rounded-md border border-slate-200 bg-white"
                />
              )}
              <span className="max-w-36 truncate text-xs font-medium text-ink">{attachment.name}</span>
              <span className="text-xs text-slate-400">{formatBytes(attachment.size)}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Remove ${attachment.name}`}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200 hover:text-ink"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files !== null) addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach photos"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <Paperclip size={16} aria-hidden="true" />
        </button>
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

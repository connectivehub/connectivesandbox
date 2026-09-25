// Live client-session chat. Messages persist as real rows in the
// `messages` table under the session; the assistant reply streams from the
// client-chat Edge Function (GLM-5.3-Flash, scoped to ONE workflow, with the
// session's judge results in context).

import type { ChatMessage } from '@/data/types'
import { callFunction, streamFunction } from '@/data/api'

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    session_id: row.session_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    created_at: row.created_at,
  }
}

export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  const { status, data } = await callFunction<{ messages?: MessageRow[]; error?: string }>(
    `/admin-api/sessions/${sessionId}/messages`,
  )
  if (status >= 400) return []
  return (data.messages ?? []).map(toChatMessage)
}

/**
 * Send one message and stream the assistant reply. The server persists both
 * sides; the caller renders the deltas and appends the final assistant
 * message to its transcript.
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  artifactIds: string[],
  onDelta: (delta: string) => void,
): Promise<{ userMessage: ChatMessage; assistantContent: string }> {
  const userMessage: ChatMessage = {
    id: `msg_user_${Date.now()}`,
    session_id: sessionId,
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  }
  let assistantContent = ''
  await streamFunction(
    '/client-chat',
    { session_id: sessionId, content, artifact_ids: artifactIds },
    (delta) => {
      assistantContent += delta
      onDelta(delta)
    },
  )
  return { userMessage, assistantContent }
}

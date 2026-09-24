// BACKEND: Supabase `chat_messages` table plus (from Phase 4) the assistant
// reply edge function replace the fixture history and canned echo in Phase 4.

import type { ChatMessage } from '@/data/types'
import { chatMessages } from '@/data/fixtures/records'

export async function getHistory(sessionId: string): Promise<ChatMessage[]> {
  return chatMessages
    .filter((message) => message.session_id === sessionId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}

export async function sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
  const message: ChatMessage = {
    id: `msg_${Date.now()}`,
    session_id: sessionId,
    role: 'user',
    content,
    created_at: new Date().toISOString(),
  }
  return message
}

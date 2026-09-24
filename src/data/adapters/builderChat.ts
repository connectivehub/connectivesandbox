// BACKEND: the builder LLM and its chat storage land in Phase 6. Until then
// histories are fixtures keyed by `${clientId}:${workflowId}` so switching
// workflows switches the conversation; a workflow with no seeded history
// opens with the assistant greeting only.

import type { BuilderChatMessage } from '@/data/fixtures/builderChat'
import { builderAckReply, builderConversation } from '@/data/fixtures/builderChat'

export function builderGreeting(): BuilderChatMessage {
  return {
    id: `bc_greeting_${Date.now()}`,
    role: 'assistant',
    content: 'Describe the workflow you need. I will draft a spec you can load into the preview.',
  }
}

const store: Record<string, BuilderChatMessage[]> = {
  'clt_001:photo-to-quote-triage': builderConversation,
  'clt_002:document-intake-review': [
    builderGreeting(),
    {
      id: 'bc_101',
      role: 'user',
      content: 'Draft a workflow to classify claims documents and check the set is complete.',
    },
    { id: 'bc_102', role: 'assistant', content: builderAckReply },
  ],
}

export async function getBuilderHistory(key: string): Promise<BuilderChatMessage[]> {
  return [...(store[key] ?? [builderGreeting()])]
}

export function appendBuilderMessage(key: string, message: BuilderChatMessage): void {
  if (store[key] === undefined) store[key] = [builderGreeting()]
  store[key].push(message)
}

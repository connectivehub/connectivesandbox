-- Phase 6: distinguish builder-chat sessions from workflow run sessions.
-- The per-workflow admin builder chat history (UI polish from Phase 3)
-- becomes real rows: one sessions row with kind='builder' per workflow, whose
-- messages table rows carry the conversation.

alter table public.sessions add column if not exists kind text not null default 'run';

create index if not exists sessions_workflow_kind_idx on public.sessions (workflow_id, kind);

-- Phase 4: data foundation.
-- Tables, default-deny RLS, private artifacts bucket with tenant-scoped
-- storage policies, and the workflow_builder agent instruction seed.
--
-- Tenancy model: every tenant-facing row carries client_id (directly, or via
-- its session). Client JWTs carry a `client_id` claim (signed by the Edge
-- Functions from Phase 5). RLS compares that claim to the row's client_id.
-- clients / agent_instructions / auth_attempts deliberately have NO
-- client-facing policy: they are reachable only via service_role inside Edge
-- Functions.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  access_code text not null unique,
  contact     text,
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

create table if not exists public.workflows (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  name        text not null,
  description text,
  spec        jsonb not null, -- full WorkflowSpec per frozen src/engine/types.ts
  status      text not null default 'draft',
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.workflows (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role       text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  storage_path text not null,
  filename     text not null,
  mime_type    text not null,
  size         bigint not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.decisions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions (id) on delete cascade,
  workflow_id  uuid not null references public.workflows (id) on delete cascade,
  judge_id     text not null,
  question     text not null,
  answer       text not null,
  confidence   numeric not null,
  probabilities jsonb not null default '{}'::jsonb,
  latency_ms   integer,
  created_at   timestamptz not null default now()
);

create table if not exists public.agent_instructions (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  content    text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_attempts (
  id         uuid primary key default gen_random_uuid(),
  code_hash  text not null,
  ip         text,
  success    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists workflows_client_idx   on public.workflows (client_id);
create index if not exists sessions_client_idx    on public.sessions (client_id);
create index if not exists sessions_workflow_idx  on public.sessions (workflow_id);
create index if not exists messages_session_idx   on public.messages (session_id);
create index if not exists artifacts_session_idx  on public.artifacts (session_id);
create index if not exists decisions_session_idx  on public.decisions (session_id);

-- ---------------------------------------------------------------------------
-- RLS: enable on EVERY table, default deny.
-- ---------------------------------------------------------------------------

alter table public.clients            enable row level security;
alter table public.workflows          enable row level security;
alter table public.sessions           enable row level security;
alter table public.messages           enable row level security;
alter table public.artifacts          enable row level security;
alter table public.decisions          enable row level security;
alter table public.agent_instructions enable row level security;
alter table public.auth_attempts      enable row level security;

-- clients, agent_instructions, auth_attempts: intentionally NO policies.
-- service_role (bypassrls) inside Edge Functions is the only access path.

-- workflows / sessions: direct client_id match.
create policy "workflows tenant select" on public.workflows
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "workflows tenant insert" on public.workflows
  for insert to authenticated
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "workflows tenant update" on public.workflows
  for update to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "workflows tenant delete" on public.workflows
  for delete to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "sessions tenant select" on public.sessions
  for select to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "sessions tenant insert" on public.sessions
  for insert to authenticated
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "sessions tenant update" on public.sessions
  for update to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid)
  with check (client_id = (auth.jwt() ->> 'client_id')::uuid);

create policy "sessions tenant delete" on public.sessions
  for delete to authenticated
  using (client_id = (auth.jwt() ->> 'client_id')::uuid);

-- messages / artifacts / decisions: scoped via the owning session's client_id.
create policy "messages tenant select" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "messages tenant insert" on public.messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "messages tenant update" on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "messages tenant delete" on public.messages
  for delete to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = messages.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "artifacts tenant select" on public.artifacts
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = artifacts.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "artifacts tenant insert" on public.artifacts
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = artifacts.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "artifacts tenant update" on public.artifacts
  for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = artifacts.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = artifacts.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "artifacts tenant delete" on public.artifacts
  for delete to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = artifacts.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "decisions tenant select" on public.decisions
  for select to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = decisions.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "decisions tenant insert" on public.decisions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = decisions.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "decisions tenant update" on public.decisions
  for update to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = decisions.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = decisions.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

create policy "decisions tenant delete" on public.decisions
  for delete to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = decisions.session_id
        and s.client_id = (auth.jwt() ->> 'client_id')::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: private `artifacts` bucket, tenant-scoped policies.
-- Object path convention: {client_id}/{session_id}/{artifact_id}-{filename}
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', false)
on conflict (id) do update set public = false;

drop policy if exists "artifacts bucket tenant select" on storage.objects;
drop policy if exists "artifacts bucket tenant insert" on storage.objects;
drop policy if exists "artifacts bucket tenant update" on storage.objects;
drop policy if exists "artifacts bucket tenant delete" on storage.objects;

create policy "artifacts bucket tenant select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.jwt() ->> 'client_id'
  );

create policy "artifacts bucket tenant insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.jwt() ->> 'client_id'
  );

create policy "artifacts bucket tenant update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.jwt() ->> 'client_id'
  )
  with check (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.jwt() ->> 'client_id'
  );

create policy "artifacts bucket tenant delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artifacts'
    and (storage.foldername(name))[1] = auth.jwt() ->> 'client_id'
  );

-- ---------------------------------------------------------------------------
-- Seed: workflow_builder admin-model instruction
-- ---------------------------------------------------------------------------

insert into public.agent_instructions (key, content)
values
  (
    'workflow_builder',
    E'You are the workflow builder for Connective Sandbox. You help a client '
    || 'turn the business decision they make today into a WorkflowSpec.\n\n'
    || '1. Interrogate first. Before proposing anything, ask what business '
    || 'decision the client makes today and exactly how they make it: what '
    || 'information they gather, what rules of thumb they apply, what '
    || 'outcomes they choose between, and where they are unsure.\n\n'
    || '2. Propose an intake surface using ONLY the registered components: '
    || 'file_upload, chat, button_group, text_field, form. Never reference '
    || 'any other component.\n\n'
    || '3. Propose judge questions with CLOSED answer sets. Every judge '
    || 'question is choice, boolean, or scalar; choice questions list every '
    || 'permissible option. No judge may return free text.\n\n'
    || '4. Emit a single WorkflowSpec JSON object matching the frozen schema: '
    || 'name, description, intake.components, judges (each with id, '
    || 'state_from, question, question_type, options where applicable, and '
    || 'thresholds.auto / thresholds.review), and dashboard.panels drawn from '
    || 'confidence_meter, analysis, monitoring, decision_log, usage_counter.\n\n'
    || '5. Refuse to invent components. If the client needs an interaction no '
    || 'registered component supports, say clearly which component is missing '
    || 'and stop; do not approximate with an unsupported component.\n\n'
    || '6. Never emit code, JSX, HTML, or CSS. Your only structured output is '
    || 'the WorkflowSpec JSON object; all other output is plain prose.'
  )
on conflict (key) do update
  set content = excluded.content,
      updated_at = now();

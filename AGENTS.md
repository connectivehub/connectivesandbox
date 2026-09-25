# AGENTS.md — Connective Sandbox

Multi-tenant AI workflow console. Authoritative spec: Notion page
"Connective Sandbox — GLM Build Instructions" (`292f699a-4023-469d-8ebd-54167f9e8c13`).
Seven phase gates; each phase commits and pushes its working branch and stops
for captain approval. Never push to `main`.

## Stack

React + Vite + TypeScript (strict), Tailwind v4, shadcn/ui (new-york, slate),
Zod. Supabase arrives in Phase 4 — do not add it before then. Do not add
dependencies beyond the standard scaffold set without a captain decision.

## Architectural invariants (enforced from phase 1 onward)

1. **No model emits UI at runtime.** An admin LLM emits a JSON `WorkflowSpec`
   validated against the Zod schema in `src/engine/schema.ts`; the fixed
   component registry (`src/engine/registry.ts`) renders it.
2. **`src/engine/` is pure.** It imports nothing from `src/data/`, Supabase,
   or any network library — ever. It contains only types, schema, registry,
   runner. The runner receives a `JudgeProvider` by injection.
3. **All data access goes through `src/data/adapters/`.** Components never
   call Supabase directly. Adapters hit the real backend exclusively — the
   Phase 1–3 fixtures were deleted in Phase 7 and nothing imports them.
4. **`src/engine/types.ts` is FROZEN.** Written verbatim in phase 1; never
   edit it in any later phase.
5. **No secret, model key, or `service_role` key ever reaches the browser.**
6. **A judge never returns free text.** `JudgeAnswer.value` is
   `string | boolean | number` and, for choice judges, must be one of the
   judge's `options`, with a full `probabilities` distribution.

## Commands

- `npm run build` — type-check + production build (must stay green)
- `npm run dev` / `npm run preview` / `npm run lint`

## Phase 5 — auth & gateway decisions

- **No new npm dependencies.** Both the adapters and the Edge Functions use
  plain `fetch`; supabase-js was rejected as unnecessary machinery (the browser
  never talks to PostgREST directly — everything rides the gateway).
- **Same-origin function calls.** The session cookie is `SameSite=Strict`, so
  the browser must send it same-site: adapters call the relative path
  `/functions/v1/…`, and the host proxies it to the Supabase project (Vite
  dev/preview proxy here; an equivalent same-origin rewrite in production).
  Cookie: `cs_session`, `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age
  86400`.
- **JWT claims.** The spec's `{ role: 'admin' | 'client', client_id }` is
  carried as `app_role` because PostgREST reserves `role` for the database
  role; the JWT sets `role: 'authenticated'` plus `app_role`/`client_id`, so
  RLS policies accept it directly. Signed HS256 with the platform JWT secret:
  this project's hosted runtime does not inject `SUPABASE_JWT_SECRET`, so the
  Edge secret `JWT_SECRET` (set in Phase 4 for this purpose) is used, with a
  `SUPABASE_JWT_SECRET` fallback for portability.
- **Rate limiters** live in the `auth_attempts` table (shared across
  isolates): 5 failed attempts per IP / 15 min → 1-hour lockout; 50 attempts
  per hour for any one code across all IPs. Every attempt is logged with a
  SHA-256 HASHED code — plaintext codes are never logged.
- **Gateway split.** `auth-code` issues sessions (POST), resolves them (GET),
  and clears them (DELETE). `admin-api` verifies the cookie server-side and
  performs admin CRUD with `service_role` internally; client sessions may only
  read their own workflows (mirroring the RLS scope, enforced server-side).
- **CORS** is an explicit allow-list (localhost dev ports + the
  `ALLOWED_ORIGINS` Edge secret); no wildcard with credentials.

## Phase 6 — workflow execution decisions

- **Judge providers live in `src/services/judge/`** (factory + `jev` (live,
  Codiv openjev via /v1/systemone), `laya_modal`/`laya_space` (implemented per
  the Laya contract, UNTESTED — no live endpoint), `mock`). Providers take
  plain config objects; only the Edge Functions resolve credentials from
  secrets. All judges in a workflow are batched into ONE provider request;
  state budget is 512 tokens/question enforced by a deterministic compressor
  (`compress.ts`, event logged). Any unparseable answer throws
  `JudgeParseError` → `run-workflow` writes confidence-0 `decisions` rows
  carrying the raw response and surfaces the failure in the UI. There is NO
  code path that substitutes an LLM judgement for a judge.
- **Deno import discipline.** Deno requires explicit `.ts` extensions on
  value imports; relative value imports in `src/services/**` carry them
  (type-only imports may stay extensionless — they are erased). Edge Functions
  import the pure engine (`src/engine/schema.ts`, `runner.ts`) directly.
- **admin-chat import map.** `supabase/functions/import_map.json` maps
  `zod` → `npm:zod` so the Edge Function can validate specs against the one
  frozen Zod schema; wired via `[functions.admin-chat] import_map` in
  config.toml. The validation/self-correction loop runs server-side (max 3
  rounds); the spec is only returned once it validates, else the validation
  error is surfaced.
- **GLM parameters (verified against current Z.ai docs).** Endpoint
  `https://api.z.ai/api/paas/v4/chat/completions`; model `glm-5.3-flash`,
  temperature 1, top_p 0.95, `thinking: {type: 'enabled'}` +
  `reasoning_effort` (GLM-5.3 series accepts low/high/max).
  **DEVIATION from brief:** `reasoning_effort: 'max'` makes a single builder
  turn think for ~150s (measured live), which kills the hosted Edge Function
  (wall-clock limit → WORKER_RESOURCE_LIMIT). Default is 'high' (same turn
  ~58s, full content); override with the `GLM_REASONING_EFFORT` secret.
  `max_tokens` is generous (16384 default) — with reasoning on, small budgets
  are consumed by thinking before any content is emitted.
- **Edge Function wall-clock budget.** admin-chat does its validation loop
  internally then streams the final reply as SSE (`{delta}` chunks, a
  `{done:true}` metadata event, `data: [DONE]`); client-chat relays GLM's SSE
  after filtering reasoning frames. Persist assistant messages BEFORE closing
  the stream — post-close work races isolate recycling (bug hit in e2e).
- **Builder chat persistence.** One `sessions` row with `kind='builder'` per
  workflow (migration 20250201…); the per-workflow admin chat history is real
  `messages` rows. Run sessions use `kind='run'`.
- **Decision ledger is the only dashboard source.** `run-workflow` writes one
  `decisions` row per judge (always, with latency_ms). Client workspace runs
  call the Edge Function; the admin live preview stays on the local fixture
  provider (never consumes judge calls or writes ledger rows — the only
  sanctioned exception). Monitoring tiles are computed from decisions rows;
  unknown metric names fall back to the decision count. Usage totals derive
  from decisions (runs = sessions with ≥1 decision row); `usage/totals` is
  readable by clients scoped to their own rows.
- **Storage flow.** `artifact-api` verifies the client JWT, checks session
  ownership, then issues a signed upload URL (path `{client_id}/{session_id}/
  {artifact_id}-{filename}`, artifact row written at sign time). Client PUTs
  the raw body; downloads use short-lived signed URLs (client chat attaches
  them as `image_url` blocks — never base64).
- **Rotated secrets this phase:** `ADMIN_ACCESS_CODE` (no plaintext existed
  after Phase 5), and set `ZAI_API_KEY`. Secrets referenced by name only.

## Phase 7 — production cleanup

- **Fixtures deleted.** `src/data/fixtures/` and `scripts/validate-fixtures.ts`
  are gone (so is the `validate:spec` script). Zero imports remain — the admin
  live preview now uses `mockJudgeProvider` from `src/services/judge/mock.ts`,
  which is behaviourally identical (same canned answers, deterministic
  fallbacks) and is the sanctioned test provider. Preview runs still never
  consume judge calls or write ledger rows.
- **`ADMIN_ACCESS_CODE` rotated this phase.** The Phase 6 value existed
  nowhere retrievable (never recorded in plaintext after `supabase secrets
  set`), so it was rotated. The current value lives in the firstmate config
  store (`/home/macbooklee/firstmate/config/connectivesandbox-admin.env`);
  reference it by NAME only, never print it.

## Brand

Connective Labs: single accent `#FF6B35`, ink `#091426`, Tailwind **slate**
neutrals (never gray), system font stack only (no webfonts). Singapore English
copy: customise, organisation, colour, `S$3,000`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

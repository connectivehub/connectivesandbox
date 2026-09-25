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
   call Supabase directly. In Phases 1–3 adapters return fixtures (each starts
   with a `// BACKEND:` comment naming what replaces its body); from Phase 4
   the same functions, same signatures, hit the real backend.
4. **`src/engine/types.ts` is FROZEN.** Written verbatim in phase 1; never
   edit it in any later phase.
5. **No secret, model key, or `service_role` key ever reaches the browser.**
6. **A judge never returns free text.** `JudgeAnswer.value` is
   `string | boolean | number` and, for choice judges, must be one of the
   judge's `options`, with a full `probabilities` distribution.

## Commands

- `npm run build` — type-check + production build (must stay green)
- `npm run validate:spec` — validates fixtures against the schema and rejects
  malformed specs
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

## Brand

Connective Labs: single accent `#FF6B35`, ink `#091426`, Tailwind **slate**
neutrals (never gray), system font stack only (no webfonts). Singapore English
copy: customise, organisation, colour, `S$3,000`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

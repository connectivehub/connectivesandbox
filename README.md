# Connective Sandbox

Multi-tenant AI workflow console. Build brief: Notion page "Connective Sandbox — GLM Build Instructions"
(id `292f699a-4023-469d-8ebd-54167f9e8c13`) — that page is the complete and authoritative specification.

Seven phase gates; each phase commits and pushes its working branch and stops for captain approval.
Never push to `main`.

See `AGENTS.md` for the architectural invariants every session must follow (pure `src/engine/`,
frozen `src/engine/types.ts`, data access only via `src/data/adapters/`).

## Commands

- `npm run dev` — local dev server
- `npm run build` — type-check + production build
- `npm run validate:spec` — validate fixture WorkflowSpecs against the schema (must accept both fixtures, reject malformed specs)
- `npm run lint`

## Auth (Phase 5)

Access codes are four digits and validated exclusively server-side by the
`auth-code` Edge Function; the browser never sees a code list. Sessions are
24-hour JWTs in an `httpOnly` cookie; see `AGENTS.md` for the full decision
record.

Sandbox trade-off (per the spec, unchanged): client access codes are stored
**plaintext** in the `clients.access_code` column and read out to clients over
WhatsApp by the admin. Only the `auth_attempts` audit log hashes codes
(SHA-256) — plaintext codes are never logged.

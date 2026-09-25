// admin-api — the admin CRUD gateway.
//
// RLS grants CLIENTS only their own rows and grants them nothing on the
// clients / auth_attempts tables, so every admin operation rides this gateway:
// the function verifies the session JWT cookie server-side and performs the
// operation with service_role internally. The browser never sees service_role
// and never talks to PostgREST directly.
//
// Clients (app_role = 'client') may use only the read-only workflow endpoints,
// and only for their own client_id — the same scoping the RLS policies would
// enforce, applied here because the browser cannot present the httpOnly
// cookie to PostgREST as a bearer token.
//
//   GET    /clients                     list clients
//   GET    /clients/:id/access-code     plaintext code (sandbox: read out over WhatsApp)
//   POST   /clients {name, access_code}
//   PATCH  /clients/:id {name}
//   DELETE /clients/:id                 cascades to workflows
//   GET    /workflows?client_id=        summaries (client: forced to own)
//   GET    /workflows/:id               summary + spec (client: own only)
//   POST   /workflows {client_id, name, spec?}
//   PATCH  /workflows/:id {name?, description?}   also patches the stored spec
//   PUT    /workflows/:id/spec {spec}             publish: bump version
//   DELETE /workflows/:id
//   GET    /usage/totals                org-wide session/decision totals
//   GET    /usage/snapshot?client_id=&period=

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { readSession } from '../_shared/jwt.ts'
import { restCount, restDelete, restInsert, restSelect, restUpdate } from '../_shared/rest.ts'

interface WorkflowRow {
  id: string
  client_id: string
  name: string
  description: string | null
  spec: Record<string, unknown>
  version: number
  updated_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: string | null): boolean {
  return value !== null && UUID_RE.test(value)
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleOptions(request)

  const session = await readSession(request)
  if (!session) return jsonResponse(request, { error: 'Not authenticated' }, 401)
  const isAdmin = session.app_role === 'admin'

  const url = new URL(request.url)
  // On the hosted platform the function name is stripped from the pathname;
  // keep the router agnostic to both prefixed and unprefixed forms.
  const parts = url.pathname.split('/').filter((segment) => segment.length > 0)
  if (parts[0] === 'admin-api') parts.shift()
  const [resource, id, sub] = parts

  try {
    // ------------------------------------------------------------------
    // Clients (admin only)
    // ------------------------------------------------------------------
    if (resource === 'clients') {
      if (!isAdmin) return jsonResponse(request, { error: 'Forbidden' }, 403)

      if (request.method === 'GET' && !id) {
        const rows = await restSelect<Record<string, unknown>>('clients', {
          select: 'id,name,access_code,contact,created_at,is_active',
          order: 'created_at.asc',
        })
        return jsonResponse(request, { clients: rows })
      }

      if (request.method === 'GET' && id && sub === 'access-code') {
        const rows = await restSelect<{ access_code: string }>('clients', {
          id: `eq.${id}`,
          select: 'access_code',
          limit: '1',
        })
        if (rows.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
        return jsonResponse(request, { access_code: rows[0].access_code })
      }

      if (request.method === 'POST' && !id) {
        const body = await request.json()
        const name = typeof body?.name === 'string' ? body.name.trim() : ''
        const accessCode = typeof body?.access_code === 'string' ? body.access_code.trim() : ''
        if (name.length === 0 || !/^\d{4}$/.test(accessCode)) {
          return jsonResponse(request, { error: 'A name and a four-digit code are required' }, 400)
        }
        const created = await restInsert<Record<string, unknown>>('clients', {
          name,
          access_code: accessCode,
        })
        return jsonResponse(request, { client: created[0] }, 201)
      }

      if (request.method === 'PATCH' && id && isUuid(id) && !sub) {
        const body = await request.json()
        const name = typeof body?.name === 'string' ? body.name.trim() : ''
        if (name.length === 0) return jsonResponse(request, { error: 'A name is required' }, 400)
        const updated = await restUpdate<Record<string, unknown>>(
          'clients',
          { id: `eq.${id}` },
          { name },
        )
        if (updated.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
        return jsonResponse(request, { client: updated[0] })
      }

      if (request.method === 'DELETE' && id && isUuid(id) && !sub) {
        await restDelete('clients', { id: `eq.${id}` })
        return jsonResponse(request, { ok: true })
      }

      return jsonResponse(request, { error: 'Unsupported client operation' }, 405)
    }

    // ------------------------------------------------------------------
    // Workflows (admin: full CRUD; client: read own)
    // ------------------------------------------------------------------
    if (resource === 'workflows') {
      if (request.method === 'GET' && !id) {
        const requestedClient = url.searchParams.get('client_id')
        const params: Record<string, string> = {
          select: 'id,client_id,name,description,version,updated_at',
          order: 'created_at.asc',
        }
        if (isAdmin) {
          if (requestedClient && isUuid(requestedClient)) {
            params.client_id = `eq.${requestedClient}`
          }
        } else {
          if (!session.client_id) return jsonResponse(request, { workflows: [] })
          params.client_id = `eq.${session.client_id}`
        }
        const rows = await restSelect<Record<string, unknown>>('workflows', params)
        return jsonResponse(request, { workflows: rows })
      }

      if (request.method === 'GET' && id && isUuid(id)) {
        const rows = await restSelect<WorkflowRow>('workflows', {
          id: `eq.${id}`,
          select: 'id,client_id,name,description,spec,version,updated_at',
          limit: '1',
        })
        if (rows.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
        if (!isAdmin && rows[0].client_id !== session.client_id) {
          return jsonResponse(request, { error: 'Forbidden' }, 403)
        }
        return jsonResponse(request, { workflow: rows[0] })
      }

      if (!isAdmin) return jsonResponse(request, { error: 'Forbidden' }, 403)

      if (request.method === 'POST' && !id) {
        const body = await request.json()
        const clientId = typeof body?.client_id === 'string' ? body.client_id : ''
        const name = typeof body?.name === 'string' ? body.name.trim() : ''
        if (!isUuid(clientId) || name.length === 0) {
          return jsonResponse(request, { error: 'client_id and name are required' }, 400)
        }
        const spec = body?.spec !== null && typeof body?.spec === 'object'
          ? body.spec
          : null
        const created = await restInsert<Record<string, unknown>>('workflows', {
          client_id: clientId,
          name,
          description: spec?.description ?? '',
          spec: spec ?? { name, description: '', intake: { components: [] }, judges: [], dashboard: { panels: [] } },
        })
        return jsonResponse(request, { workflow: created[0] }, 201)
      }

      if (request.method === 'PATCH' && id && isUuid(id) && !sub) {
        const body = await request.json()
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        const name = typeof body?.name === 'string' ? body.name.trim() : null
        const description = typeof body?.description === 'string' ? body.description : null
        if (name === null && description === null) {
          return jsonResponse(request, { error: 'Nothing to update' }, 400)
        }
        // Keep the stored spec in step with the summary columns.
        if (name !== null || description !== null) {
          const rows = await restSelect<WorkflowRow>('workflows', {
            id: `eq.${id}`,
            select: 'spec',
            limit: '1',
          })
          if (rows.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
          const spec = { ...rows[0].spec }
          if (name !== null) spec.name = name
          if (description !== null) spec.description = description
          patch.spec = spec
        }
        if (name !== null) patch.name = name
        if (description !== null) patch.description = description
        const updated = await restUpdate<Record<string, unknown>>(
          'workflows',
          { id: `eq.${id}` },
          patch,
        )
        if (updated.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
        return jsonResponse(request, { workflow: updated[0] })
      }

      if (request.method === 'PUT' && id && isUuid(id) && sub === 'spec') {
        const body = await request.json()
        const spec = body?.spec
        if (spec === null || typeof spec !== 'object') {
          return jsonResponse(request, { error: 'A spec object is required' }, 400)
        }
        const rows = await restSelect<{ version: number }>('workflows', {
          id: `eq.${id}`,
          select: 'version',
          limit: '1',
        })
        if (rows.length === 0) return jsonResponse(request, { error: 'Not found' }, 404)
        const description = typeof spec.description === 'string' ? spec.description : ''
        const updated = await restUpdate<Record<string, unknown>>(
          'workflows',
          { id: `eq.${id}` },
          {
            spec,
            description,
            version: rows[0].version + 1,
            updated_at: new Date().toISOString(),
          },
        )
        return jsonResponse(request, { workflow: updated[0] })
      }

      if (request.method === 'DELETE' && id && isUuid(id) && !sub) {
        await restDelete('workflows', { id: `eq.${id}` })
        return jsonResponse(request, { ok: true })
      }

      return jsonResponse(request, { error: 'Unsupported workflow operation' }, 405)
    }

    // ------------------------------------------------------------------
    // Usage (admin only) — computed from sessions/decisions; no usage table.
    // ------------------------------------------------------------------
    if (resource === 'usage') {
      if (!isAdmin) return jsonResponse(request, { error: 'Forbidden' }, 403)

      if (request.method === 'GET' && id === 'totals') {
        const runsThisMonth = await restCount('sessions', {})
        const decisionsMade = await restCount('decisions', {})
        return jsonResponse(request, { runsThisMonth, decisionsMade })
      }

      if (request.method === 'GET' && id === 'snapshot') {
        const clientId = url.searchParams.get('client_id')
        const sessionParams: Record<string, string> = {}
        if (clientId && isUuid(clientId)) sessionParams.client_id = `eq.${clientId}`
        const sessions = await restCount('sessions', sessionParams)
        // decisions scope through their session (no client_id column).
        let judgeCalls = 0
        if (sessions > 0) {
          const sessionIds = await restSelect<{ id: string }>('sessions', {
            ...(clientId && isUuid(clientId) ? { client_id: `eq.${clientId}` } : {}),
            select: 'id',
          })
          judgeCalls = await restCount('decisions', {
            session_id: `in.(${sessionIds.map((row) => row.id).join(',')})`,
          })
        }
        return jsonResponse(request, { sessions, judge_calls: judgeCalls, tokens: 0 })
      }

      return jsonResponse(request, { error: 'Unsupported usage operation' }, 405)
    }

    return jsonResponse(request, { error: 'Unknown resource' }, 404)
  } catch (error) {
    console.error('admin-api error:', error instanceof Error ? error.message : error)
    return jsonResponse(request, { error: 'Internal error' }, 500)
  }
})

// auth-codes — PUBLIC BY DESIGN (captain decision, polish 3).
//
// Serves the code → { role, client_id } map the browser validates against:
// admin code from the ADMIN_ACCESS_CODE secret, client codes from the
// `clients` table. The four-digit codes are a convenience gate for a sandbox,
// not a security boundary — the README trade-off section records why this is
// acceptable and what a production hardening would replace it with.
//
//   GET → { codes: { "<code>": { role, client_id } } }

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { restSelect } from '../_shared/rest.ts'

interface ClientRow {
  id: string
  access_code: string
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleOptions(request)
  if (request.method !== 'GET') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405)
  }

  const codes: Record<string, { role: 'admin' | 'client'; client_id: string | null }> = {}

  const adminCode = Deno.env.get('ADMIN_ACCESS_CODE')
  if (adminCode !== undefined && /^\d{4}$/.test(adminCode)) {
    codes[adminCode] = { role: 'admin', client_id: null }
  }

  try {
    const clients = await restSelect<ClientRow>('clients', {
      is_active: 'eq.true',
      select: 'id,access_code',
    })
    for (const client of clients) {
      if (/^\d{4}$/.test(client.access_code)) {
        codes[client.access_code] = { role: 'client', client_id: client.id }
      }
    }
  } catch (error) {
    // The admin code still works if the clients read fails.
    console.error('auth-codes clients read failed', error instanceof Error ? error.message : error)
  }

  return jsonResponse(request, { codes })
})

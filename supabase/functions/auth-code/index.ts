// auth-code — the only issuer of console sessions.
//
//   POST    { role, client_id? } → mints a 24h session JWT in an httpOnly
//                                 cookie. The four-digit code check happens
//                                 CLIENT-SIDE against the public code map
//                                 served by `auth-codes`; this function trusts
//                                 that decision by design (sandbox-grade gate,
//                                 see the README trade-off section).
//   GET                          → session read: resolves the current session
//                                 from the cookie (never accepts a code).
//   DELETE                       → logout: clears the session cookie.
//
// There is deliberately NO code validation, NO attempt logging, and NO rate
// limiting here anymore — the captain's decision moved the gate into the
// browser for the sandbox. The cookie stays HttpOnly; Secure; SameSite=Strict.
//
// See AGENTS.md for the cookie/gateway design decision record.

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { clearSessionCookie, readSession, sessionCookie, signJwt } from '../_shared/jwt.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleOptions(request)

  // --- Logout: clear the cookie -------------------------------------------
  if (request.method === 'DELETE') {
    return jsonResponse(request, { ok: true }, 200, { 'Set-Cookie': clearSessionCookie() })
  }

  // --- Session read (GET): resolve the cookie, never accept a code here ----
  if (request.method === 'GET') {
    const session = await readSession(request)
    if (!session) {
      return jsonResponse(request, { authenticated: false }, 401)
    }
    return jsonResponse(request, {
      authenticated: true,
      role: session.app_role,
      client_id: session.client_id ?? null,
      expires_at: session.exp,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405)
  }

  // --- Login: mint a session from the trusted browser decision -------------
  let role: unknown
  let clientId: unknown
  try {
    const body = await request.json()
    role = body?.role
    clientId = body?.client_id
  } catch {
    return jsonResponse(request, { error: 'Invalid request body' }, 400)
  }
  if (role !== 'admin' && role !== 'client') {
    return jsonResponse(request, { error: 'Invalid role' }, 400)
  }
  const resolvedClientId = role === 'client' && typeof clientId === 'string' ? clientId : null

  const token = await signJwt({
    app_role: role,
    ...(resolvedClientId !== null ? { client_id: resolvedClientId } : {}),
  })
  return jsonResponse(
    request,
    { role, client_id: resolvedClientId },
    200,
    { 'Set-Cookie': sessionCookie(token) },
  )
})

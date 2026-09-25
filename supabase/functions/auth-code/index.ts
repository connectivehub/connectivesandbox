// auth-code — the only issuer of console sessions.
//
//   POST    { code }  → validates the four-digit code SERVER-SIDE, applies
//                       both rate limiters, logs the attempt (hashed code),
//                       and issues a 24h session JWT in an httpOnly cookie.
//   GET               → session read: resolves the current session from the
//                       cookie (never accepts a code via GET).
//   DELETE            → logout: clears the session cookie.
//
// Codes are never sent to the browser, never logged in plaintext, and the
// access-code list never leaves this function.
//
// Rate limiters (state lives in the auth_attempts table, shared across
// isolates/regions):
//   - per IP:    5 failed attempts / 15 min → locked out for 1 hour.
//   - per code:  50 attempts / hour across all IPs (any outcome).
//
// See AGENTS.md for the cookie/gateway design decision record.

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import {
  clearSessionCookie,
  readSession,
  sessionCookie,
  sha256Hex,
  signJwt,
} from '../_shared/jwt.ts'
import { restInsert, restSelect } from '../_shared/rest.ts'

const MAX_FAILURES_PER_IP = 5
const IP_WINDOW_MINUTES = 15
const IP_LOCKOUT_MINUTES = 60
const MAX_ATTEMPTS_PER_CODE = 50
const CODE_WINDOW_MINUTES = 60

interface AuthAttempt {
  created_at: string
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

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

  // --- Login: validate the posted code -------------------------------------
  let code: unknown
  try {
    const body = await request.json()
    code = body?.code
  } catch {
    return jsonResponse(request, { error: 'Invalid request body' }, 400)
  }
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) {
    return jsonResponse(request, { error: 'Incorrect access code' }, 401)
  }

  const ip = clientIp(request)
  const codeHash = await sha256Hex(code)

  // --- Limiter 1: five failures per IP per 15 min → 1-hour lockout ---------
  const recentIpFailures = await restSelect<AuthAttempt>('auth_attempts', {
    ip: `eq.${ip}`,
    success: 'eq.false',
    created_at: `gte.${isoMinutesAgo(IP_WINDOW_MINUTES)}`,
    order: 'created_at.desc',
    limit: String(MAX_FAILURES_PER_IP),
  })
  if (recentIpFailures.length >= MAX_FAILURES_PER_IP) {
    const fifthFailure = new Date(recentIpFailures[MAX_FAILURES_PER_IP - 1].created_at)
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((fifthFailure.getTime() + IP_LOCKOUT_MINUTES * 60_000 - Date.now()) / 1000),
    )
    await logAttempt(codeHash, ip, false)
    return jsonResponse(
      request,
      { error: 'Too many attempts. Try again later.' },
      429,
      { 'Retry-After': String(retryAfterSeconds) },
    )
  }

  // --- Limiter 2: 50 attempts per hour for any one code, across all IPs ----
  const recentCodeAttempts = await restSelect<AuthAttempt>('auth_attempts', {
    code_hash: `eq.${codeHash}`,
    created_at: `gte.${isoMinutesAgo(CODE_WINDOW_MINUTES)}`,
    order: 'created_at.desc',
    limit: String(MAX_ATTEMPTS_PER_CODE),
  })
  if (recentCodeAttempts.length >= MAX_ATTEMPTS_PER_CODE) {
    await logAttempt(codeHash, ip, false)
    return jsonResponse(
      request,
      { error: 'Too many attempts. Try again later.' },
      429,
      { 'Retry-After': String(CODE_WINDOW_MINUTES * 60) },
    )
  }

  // --- Code validation, exclusively server-side ----------------------------
  let role: 'admin' | 'client' | null = null
  let clientId: string | null = null

  const adminCode = Deno.env.get('ADMIN_ACCESS_CODE')
  if (adminCode && code === adminCode) {
    role = 'admin'
  } else {
    const rows = await restSelect<{ id: string }>('clients', {
      access_code: `eq.${code}`,
      is_active: 'eq.true',
      select: 'id',
      limit: '1',
    })
    if (rows.length > 0) {
      role = 'client'
      clientId = rows[0].id
    }
  }

  const success = role !== null
  await logAttempt(codeHash, ip, success)

  if (!success) {
    return jsonResponse(request, { error: 'Incorrect access code' }, 401)
  }

  // --- Issue the session cookie --------------------------------------------
  const token = await signJwt({
    app_role: role,
    ...(clientId ? { client_id: clientId } : {}),
  })
  return jsonResponse(
    request,
    { role, client_id: clientId },
    200,
    { 'Set-Cookie': sessionCookie(token) },
  )
})

/** Log the attempt with a HASHED code — plaintext codes are never logged. */
async function logAttempt(codeHash: string, ip: string, success: boolean): Promise<void> {
  try {
    await restInsert('auth_attempts', { code_hash: codeHash, ip, success })
  } catch (error) {
    // Audit logging must never block or reveal the auth decision path.
    console.error('auth_attempts insert failed', error instanceof Error ? error.message : error)
  }
}

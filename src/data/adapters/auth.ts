// Real auth adapter. The four-digit gate is CLIENT-SIDE (captain decision,
// polish 3): the browser validates the code against the public code→{role,
// client_id} map served by the `auth-codes` function — public by design for a
// sandbox. A matching code mints the session JWT through the `auth-code`
// Edge Function, which arrives as an httpOnly cookie and is only ever
// resolved server-side.

import type { AuthSession, User } from '@/data/types'
import { viaCache } from '@/data/prefetch'
import { ApiError, callFunction } from '@/data/api'

export type AccessRole = 'admin' | 'workspace'

export interface ConsoleSession {
  role: 'admin' | 'client'
  client_id: string | null
}

export interface CodeEntry {
  role: 'admin' | 'client'
  client_id: string | null
}

/** code → role/client_id, public by design (sandbox-grade convenience gate). */
export type AccessCodeMap = Record<string, CodeEntry>

interface AuthCodeResponse {
  role?: string
  client_id?: string | null
  authenticated?: boolean
  error?: string
}

/** Response shape for the public auth-codes endpoint. */
interface AuthCodesResponse {
  codes?: AccessCodeMap
  error?: string
}

/** The public code map, read through the warm cache so login needs no wait. */
export function getAccessCodeMap(): Promise<AccessCodeMap> {
  return viaCache('auth:codes', async () => {
    const { status, data } = await callFunction<AuthCodesResponse>('/auth-codes')
    if (status >= 400 || data.codes === undefined) {
      throw new ApiError(data.error ?? 'Access codes unavailable', status)
    }
    return data.codes
  })
}

/** Mint the session JWT from the already-validated browser decision. */
export async function mintSession(entry: CodeEntry): Promise<ConsoleSession> {
  const { status, data } = await callFunction<AuthCodeResponse>('/auth-code', {
    method: 'POST',
    body: { role: entry.role, client_id: entry.client_id },
  })
  if (status === 200 && data.role === 'admin') return { role: 'admin', client_id: null }
  if (status === 200 && data.role === 'client') {
    return { role: 'client', client_id: data.client_id ?? null }
  }
  throw new ApiError(data.error ?? 'Could not start the session', status)
}

/**
 * Read the current session from the httpOnly cookie (server-side resolution —
 * the token itself is never readable from JS). Returns null when signed out.
 */
export async function getSession(): Promise<ConsoleSession | null> {
  try {
    const { status, data } = await callFunction<AuthCodeResponse>('/auth-code')
    if (status === 200 && data.authenticated && (data.role === 'admin' || data.role === 'client')) {
      return { role: data.role, client_id: data.client_id ?? null }
    }
    return null
  } catch {
    // No backend reachable (e.g. offline dev) — treat as signed out.
    return null
  }
}

/** Clear the session cookie. */
export async function signOut(): Promise<void> {
  await callFunction('/auth-code', { method: 'DELETE' })
}

// Email/password sign-in is not part of this console (access codes only);
// the signature is kept for adapter-shape parity with the data contract.
export async function signIn(email: string, password: string): Promise<AuthSession> {
  void password
  throw new ApiError(
    `Password sign-in is not available for ${email}. Use your four-digit access code.`,
    400,
  )
}

/** Best-effort current user derived from the cookie session. */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession()
  if (!session) return null
  if (session.role === 'admin') {
    return { id: 'admin', email: '', name: 'Console administrator', role: 'admin' }
  }
  return {
    id: session.client_id ?? 'client',
    email: '',
    name: 'Client',
    role: 'owner',
  }
}

// Real auth adapter (Phase 5). Codes are validated EXCLUSIVELY server-side by
// the `auth-code` Edge Function: the browser never sees a code list, a session
// JWT arrives in an httpOnly cookie, and session state is read from that
// cookie. Same signatures as the Phase 1–3 fixture adapter.

import type { AuthSession, User } from '@/data/types'
import { ApiError, callFunction } from '@/data/api'

export type AccessRole = 'admin' | 'workspace'

export interface ConsoleSession {
  role: 'admin' | 'client'
  client_id: string | null
}

interface AuthCodeResponse {
  role?: string
  client_id?: string | null
  authenticated?: boolean
  error?: string
}

/** Verify a four-digit access code and establish the server-side session. */
export async function verifyAccessCode(code: string): Promise<AccessRole> {
  const { status, data } = await callFunction<AuthCodeResponse>('/auth-code', {
    method: 'POST',
    body: { code },
  })
  if (status === 200 && data.role === 'admin') return 'admin'
  if (status === 200 && data.role === 'client') return 'workspace'
  if (status === 429) {
    throw new ApiError(data.error ?? 'Too many attempts. Try again later.', 429)
  }
  throw new ApiError(data.error ?? 'Incorrect access code', status)
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

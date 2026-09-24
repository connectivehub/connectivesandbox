// BACKEND: Supabase auth (GoTrue) replaces this fixture code verification in
// Phase 5 — server-side validation, real session tokens, no secrets in the
// browser. Same signatures: callers pass a four-digit access code and receive
// the tenant role the console opens into, or an error for an unknown code.

import type { AuthSession, User } from '@/data/types'
import { users } from '@/data/fixtures/records'

export type AccessRole = 'admin' | 'workspace'

// Fixture contract: 0136 opens the admin console, 4821 opens a workspace.
// The mapping lives here, not in the UI, so Phase 5 can move it server-side
// without touching the screens.
const ACCESS_CODES: Record<string, AccessRole> = {
  '0136': 'admin',
  '4821': 'workspace',
}

export async function verifyAccessCode(code: string): Promise<AccessRole> {
  const role = ACCESS_CODES[code]
  if (!role) {
    throw new Error('Incorrect access code')
  }
  return role
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const user = users.find((candidate) => candidate.email === email.toLowerCase())
  if (!user || password.length === 0) {
    throw new Error('Invalid email or password')
  }
  return { user, token: `fixture-token-${user.id}` }
}

export async function signOut(): Promise<void> {
  // Fixture: nothing to invalidate.
}

export async function getCurrentUser(): Promise<User | null> {
  return users[0] ?? null
}

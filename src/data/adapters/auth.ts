// BACKEND: Supabase auth (GoTrue) replaces the fixture user lookup in Phase 4;
// same signatures, real session tokens, no secrets in the browser.

import type { AuthSession, User } from '@/data/types'
import { users } from '@/data/fixtures/records'

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

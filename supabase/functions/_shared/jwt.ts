// Shared JWT + cookie helpers for the session issued by `auth-code` and
// verified by `admin-api`.
//
// Claims design (see AGENTS.md for the full decision record):
//   role:       'authenticated' — PostgREST reserves `role` for the database
//               role; without it, RLS policies `to authenticated` never apply.
//   app_role:   'admin' | 'client' — the spec's { role: 'admin' | 'client' },
//               moved aside because `role` is reserved.
//   client_id:  uuid, present only for client sessions. RLS policies compare
//               this claim to the row's client_id.
//   exp/iat:    24-hour session.
//
// Signed HS256 with the platform JWT secret so PostgREST accepts these claims
// directly for RLS. Note: this project's hosted runtime does not inject
// SUPABASE_JWT_SECRET; the secret set in Phase 4 as JWT_SECRET is used instead
// (see AGENTS.md).

export const SESSION_COOKIE = 'cs_session'
export const SESSION_TTL_SECONDS = 24 * 60 * 60

/** The platform JWT secret, under whichever name this runtime injects it. */
function jwtSecret(): string | undefined {
  return Deno.env.get('SUPABASE_JWT_SECRET') ?? Deno.env.get('JWT_SECRET')
}

export type AppRole = 'admin' | 'client'

export interface SessionClaims {
  role: 'authenticated'
  app_role: AppRole
  client_id?: string
  exp: number
  iat: number
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Sign an HS256 JWT with the platform secret. */
export async function signJwt(
  claims: Omit<SessionClaims, 'role' | 'exp' | 'iat'>,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const secret = jwtSecret()
  if (!secret) throw new Error('No platform JWT secret is available')
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionClaims = {
    role: 'authenticated',
    exp: now + ttlSeconds,
    iat: now,
    ...claims,
  }
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' })
  const body = encodeJson(payload)
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${base64UrlEncode(new Uint8Array(signature))}`
}

/** Verify an HS256 JWT signed with the platform secret. Returns null if invalid or expired. */
export async function verifyJwt(token: string): Promise<SessionClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  let parsedHeader: { alg?: string }
  let claims: SessionClaims
  try {
    parsedHeader = decodeJson(header)
    claims = decodeJson(body)
  } catch {
    return null
  }
  if (parsedHeader.alg !== 'HS256') return null
  const secret = jwtSecret()
  if (!secret) return null
  const key = await hmacKey(secret)
  const expected = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${body}`),
  )
  const expectedBase64 = base64UrlEncode(new Uint8Array(expected))
  if (expectedBase64.length !== signature.length) return null
  // Constant-time-ish comparison to avoid trivially leaking a mismatch prefix.
  let mismatch = 0
  for (let i = 0; i < expectedBase64.length; i++) {
    mismatch |= expectedBase64.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  if (mismatch !== 0) return null
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
  return claims
}

/** Build the Set-Cookie value for a session JWT. */
export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`
}

/** Build the Set-Cookie value that clears the session cookie. */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
}

/** Extract and verify the session from a request's cookie header. */
export async function readSession(request: Request): Promise<SessionClaims | null> {
  const cookieHeader = request.headers.get('Cookie') ?? ''
  const cookies = new Map(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('='))
      .map((part) => {
        const index = part.indexOf('=')
        return [part.slice(0, index), part.slice(index + 1)] as const
      }),
  )
  const token = cookies.get(SESSION_COOKIE)
  if (!token) return null
  return verifyJwt(token)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

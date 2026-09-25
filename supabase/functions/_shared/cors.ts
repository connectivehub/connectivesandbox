// Shared CORS helpers for the Connective Sandbox Edge Functions.
//
// No wildcard with credentials: the allow-list is explicit. Local dev/preview
// origins are always allowed; additional origins (e.g. the future production
// origin) are appended from the ALLOWED_ORIGINS secret (comma-separated).
// In the sandbox the app normally talks to these functions through a
// same-origin proxy (see AGENTS.md), so most requests carry no Origin header
// at all — those are always same-origin and pass through untouched.

const LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
]

function allowedOrigins(): string[] {
  const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  return [...LOCAL_ORIGINS, ...extra]
}

/** CORS headers for a request's Origin, or null when the origin is not allowed. */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  if (origin === null || !allowedOrigins().includes(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Apikey',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function handleOptions(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

/** JSON response with CORS headers attached. */
export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
      ...extraHeaders,
    },
  })
}

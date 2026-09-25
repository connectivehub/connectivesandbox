// Thin fetch helper for the Edge Functions. The app talks to its OWN origin
// (`/functions/v1/...`) and the host proxies to Supabase — see AGENTS.md for
// why (SameSite=Strict session cookie ⇒ same-origin function calls). The
// anon/publishable key is public by design; no service_role or other secret
// ever appears here.

const FUNCTIONS_BASE: string = import.meta.env.VITE_FUNCTIONS_BASE ?? '/functions/v1'
const ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface FunctionResponse<T> {
  status: number
  data: T
}

/** Call an Edge Function with credentials so the session cookie rides along. */
export async function callFunction<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<FunctionResponse<T>> {
  const headers: Record<string, string> = {}
  if (ANON_KEY.length > 0) headers.apikey = ANON_KEY
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${FUNCTIONS_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    credentials: 'include',
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const text = await response.text()
  let data: unknown = {}
  if (text.length > 0) {
    try {
      data = JSON.parse(text)
    } catch {
      data = {}
    }
  }
  return { status: response.status, data: data as T }
}

/** Throw a readable ApiError when the gateway rejects an admin operation. */
export function assertOk(response: FunctionResponse<{ error?: string }>): void {
  if (response.status >= 400) {
    throw new ApiError(
      response.data.error ?? `Request failed (${response.status})`,
      response.status,
    )
  }
}

// Minimal PostgREST client for Edge Functions (plain fetch — no supabase-js).
// Always called with the service role key INSIDE the function; the browser
// never sees it (AGENTS.md invariant 5).

export function restUrl(path: string, params: Record<string, string> = {}): string {
  const base = Deno.env.get('SUPABASE_URL')
  const url = new URL(`/rest/v1/${path}`, base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    'Content-Type': 'application/json',
    ...extra,
  }
}

/** GET a list of rows. */
export async function restSelect<T>(
  table: string,
  params: Record<string, string>,
): Promise<T[]> {
  const response = await fetch(restUrl(table, params), {
    headers: serviceHeaders(),
  })
  if (!response.ok) {
    throw new Error(`rest select ${table} failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T[]
}

/** POST (insert) and return the created rows. */
export async function restInsert<T>(table: string, rows: unknown): Promise<T[]> {
  const response = await fetch(restUrl(table), {
    method: 'POST',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(rows),
  })
  if (!response.ok) {
    throw new Error(`rest insert ${table} failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T[]
}

/** PATCH rows matching params and return the updated rows. */
export async function restUpdate<T>(
  table: string,
  params: Record<string, string>,
  patch: unknown,
): Promise<T[]> {
  const response = await fetch(restUrl(table, params), {
    method: 'PATCH',
    headers: serviceHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    throw new Error(`rest update ${table} failed: ${response.status} ${await response.text()}`)
  }
  return (await response.json()) as T[]
}

/** DELETE rows matching params. */
export async function restDelete(table: string, params: Record<string, string>): Promise<void> {
  const response = await fetch(restUrl(table, params), { method: 'DELETE', headers: serviceHeaders() })
  if (!response.ok) {
    throw new Error(`rest delete ${table} failed: ${response.status} ${await response.text()}`)
  }
}

/** HEAD-style count using PostgREST's Prefer: count=exact. */
export async function restCount(table: string, params: Record<string, string>): Promise<number> {
  const response = await fetch(restUrl(table, { ...params, limit: '0' }), {
    headers: serviceHeaders({ Prefer: 'count=exact', Range: '0-0' }),
  })
  if (!response.ok) {
    throw new Error(`rest count ${table} failed: ${response.status} ${await response.text()}`)
  }
  const range = response.headers.get('Content-Range') ?? '*/0'
  const total = range.split('/')[1]
  return Number.isNaN(Number(total)) ? 0 : Number(total)
}

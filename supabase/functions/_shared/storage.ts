// Storage helpers for the private `artifacts` bucket. Uploads happen through
// a signed upload URL issued by the Edge Function ONLY after the JWT's
// client_id has been checked against the session; downloads go through
// short-lived signed URLs. Path convention: {client_id}/{session_id}/{artifact_id}-{filename}.
// Plain fetch + the service role key inside the function — the browser never
// sees a service key (AGENTS.md invariant 5).

const BUCKET = 'artifacts'

function storageUrl(path: string): string {
  return new URL(`/storage/v1/${path.replace(/^\//, '')}`, Deno.env.get('SUPABASE_URL')).toString()
}

function serviceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    'Content-Type': 'application/json',
    ...extra,
  }
}

export interface SignedUpload {
  /** Full URL the client PUTs the raw file body to (no auth header needed). */
  url: string
  token: string
}

/** Create a signed upload URL for an object path. */
export async function createSignedUploadUrl(path: string, expiresIn = 3600): Promise<SignedUpload> {
  const response = await fetch(storageUrl(`object/upload/sign/${BUCKET}/${path}`), {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ expiresIn }),
  })
  if (!response.ok) {
    throw new Error(`signed upload url failed: ${response.status} ${await response.text()}`)
  }
  const parsed = (await response.json()) as { url?: string; token?: string }
  if (!parsed.url || !parsed.token) {
    throw new Error('signed upload url response missing url/token')
  }
  return { url: storageUrl(parsed.url), token: parsed.token }
}

/** Create a short-lived signed download URL for an object path. */
export async function createSignedDownloadUrl(path: string, expiresIn = 300): Promise<string> {
  const response = await fetch(storageUrl(`object/sign/${BUCKET}/${path}`), {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ expiresIn }),
  })
  if (!response.ok) {
    throw new Error(`signed download url failed: ${response.status} ${await response.text()}`)
  }
  const parsed = (await response.json()) as { signedURL?: string }
  if (!parsed.signedURL) throw new Error('signed download response missing signedURL')
  return storageUrl(parsed.signedURL)
}

/** Delete an object (best-effort cleanup when an artifact row is removed). */
export async function deleteObject(path: string): Promise<void> {
  await fetch(storageUrl(`object/${BUCKET}/${path}`), {
    method: 'DELETE',
    headers: serviceHeaders(),
  })
}

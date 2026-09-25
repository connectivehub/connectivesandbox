// Storage adapter (Phase 6). Uploads go through a signed URL issued by the
// artifact-api Edge Function ONLY after the JWT's client_id has been checked
// against the session; downloads use short-lived signed URLs. Objects live at
// {client_id}/{session_id}/{artifact_id}-{filename}; every upload writes an
// `artifacts` row (issued server-side when the URL is signed).

import { callFunction } from '@/data/api'

export interface SessionRef {
  id: string
  client_id: string
  workflow_id: string
}

export interface ArtifactDescriptor {
  id: string
  filename: string
  mime_type: string
  size: number
}

interface SessionResponse {
  session?: SessionRef
  error?: string
}

interface SignUploadResponse {
  artifact_id?: string
  upload?: { url: string; token: string }
  error?: string
}

interface SignDownloadResponse {
  url?: string
  filename?: string
  error?: string
}

/** Create a run session for a workflow (scoped to the logged-in client). */
export async function ensureRunSession(workflowId: string): Promise<SessionRef> {
  const { status, data } = await callFunction<SessionResponse>('/artifact-api/sessions', {
    method: 'POST',
    body: { workflow_id: workflowId },
  })
  if (status >= 400 || !data.session) {
    throw new Error(data.error ?? `Could not create session (${status})`)
  }
  return data.session
}

/**
 * Upload one file: sign, PUT the raw body to the signed URL, return the
 * artifact descriptor for the intake state / judge state.
 */
export async function uploadArtifact(
  sessionId: string,
  file: File,
): Promise<ArtifactDescriptor> {
  const signResponse = await callFunction<SignUploadResponse>('/artifact-api/sign-upload', {
    method: 'POST',
    body: {
      session_id: sessionId,
      filename: file.name,
      mime_type: file.type.length > 0 ? file.type : 'application/octet-stream',
      size: file.size,
    },
  })
  if (signResponse.status >= 400 || !signResponse.data.upload || !signResponse.data.artifact_id) {
    throw new Error(signResponse.data.error ?? `Upload sign failed (${signResponse.status})`)
  }
  const put = await fetch(signResponse.data.upload.url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type.length > 0 ? file.type : 'application/octet-stream' },
    body: file,
  })
  if (!put.ok) {
    throw new Error(`Upload failed (${put.status})`)
  }
  return {
    id: signResponse.data.artifact_id,
    filename: file.name,
    mime_type: file.type,
    size: file.size,
  }
}

/** Short-lived signed download URL for one artifact. */
export async function getArtifactUrl(artifactId: string): Promise<string> {
  const { status, data } = await callFunction<SignDownloadResponse>('/artifact-api/sign-download', {
    method: 'POST',
    body: { artifact_id: artifactId },
  })
  if (status >= 400 || !data.url) {
    throw new Error(data.error ?? `Could not sign download (${status})`)
  }
  return data.url
}

export interface ArtifactRow extends ArtifactDescriptor {
  created_at: string
}

export async function listArtifacts(sessionId: string): Promise<ArtifactRow[]> {
  const { status, data } = await callFunction<{ artifacts?: ArtifactRow[]; error?: string }>(
    `/artifact-api/artifacts?session_id=${encodeURIComponent(sessionId)}`,
  )
  if (status >= 400) throw new Error(data.error ?? `Could not list artifacts (${status})`)
  return data.artifacts ?? []
}

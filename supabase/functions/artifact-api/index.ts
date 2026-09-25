// artifact-api — storage gateway for the private `artifacts` bucket.
//
//   POST /sessions            { workflow_id }                    create a run session
//   POST /sign-upload         { session_id, filename, mime_type, size }
//   POST /sign-download       { artifact_id }                    short-lived signed URL
//   GET  /artifacts?session_id=                                  list session artifacts
//
// Every route verifies the client JWT cookie FIRST and checks that the
// session belongs to the JWT's client_id before touching storage. Upload
// happens by the client PUTting the raw file to the signed upload URL (no
// credentials on that request); the object path is
// {client_id}/{session_id}/{artifact_id}-{filename}. An `artifacts` row is
// written when the upload URL is issued.

import { handleOptions, jsonResponse } from '../_shared/cors.ts'
import { readSession } from '../_shared/jwt.ts'
import { restInsert, restSelect, restUpdate } from '../_shared/rest.ts'
import { createSignedDownloadUrl, createSignedUploadUrl } from '../_shared/storage.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_BYTES = 50 * 1024 * 1024

interface SessionRow {
  id: string
  client_id: string
  workflow_id: string
}

interface ArtifactRow {
  id: string
  session_id: string
  storage_path: string
  filename: string
  mime_type: string
  size: number
  created_at: string
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned.slice(-120) : 'file'
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return handleOptions(request)

  const session = await readSession(request)
  if (!session) return jsonResponse(request, { error: 'Not authenticated' }, 401)
  if (session.app_role !== 'client' || !session.client_id) {
    return jsonResponse(request, { error: 'Client session required' }, 403)
  }
  const clientId = session.client_id

  const url = new URL(request.url)
  const parts = url.pathname.split('/').filter((segment) => segment.length > 0)
  if (parts[0] === 'artifact-api') parts.shift()
  const [resource] = parts

  try {
    // ---------------------------------------------------------------
    // POST /sessions — create a run session for one of OUR workflows.
    // ---------------------------------------------------------------
    if (resource === 'sessions' && request.method === 'POST') {
      const body = await request.json() as { workflow_id?: string }
      const workflowId = body.workflow_id ?? ''
      if (!UUID_RE.test(workflowId)) return jsonResponse(request, { error: 'workflow_id is required' }, 400)
      const workflows = await restSelect<{ id: string }>('workflows', {
        id: `eq.${workflowId}`,
        client_id: `eq.${clientId}`,
        select: 'id',
        limit: '1',
      })
      if (workflows.length === 0) return jsonResponse(request, { error: 'Workflow not found' }, 404)
      const created = await restInsert<SessionRow>('sessions', {
        workflow_id: workflowId,
        client_id: clientId,
        kind: 'run',
      })
      return jsonResponse(request, { session: created[0] }, 201)
    }

    // ---------------------------------------------------------------
    // POST /sign-upload — signed upload URL for one artifact.
    // ---------------------------------------------------------------
    if (resource === 'sign-upload' && request.method === 'POST') {
      const body = await request.json() as {
        session_id?: string
        filename?: string
        mime_type?: string
        size?: number
      }
      const sessionId = body.session_id ?? ''
      const filename = safeFilename(body.filename ?? 'file')
      const mimeType = body.mime_type ?? 'application/octet-stream'
      const size = Number.isFinite(body.size) ? Math.max(0, Math.round(body.size ?? 0)) : 0
      if (!UUID_RE.test(sessionId)) return jsonResponse(request, { error: 'session_id is required' }, 400)
      if (size > MAX_BYTES) return jsonResponse(request, { error: 'File exceeds the 50MB limit' }, 413)

      // Session must belong to the JWT's client.
      const sessions = await restSelect<SessionRow>('sessions', {
        id: `eq.${sessionId}`,
        client_id: `eq.${clientId}`,
        select: 'id,client_id,workflow_id',
        limit: '1',
      })
      const runSession = sessions[0]
      if (!runSession) return jsonResponse(request, { error: 'Session not found' }, 404)

      // Artifact row first (its id names the object).
      const artifacts = await restInsert<ArtifactRow>('artifacts', {
        session_id: sessionId,
        storage_path: 'pending',
        filename,
        mime_type: mimeType,
        size,
      })
      const artifact = artifacts[0]
      if (!artifact) return jsonResponse(request, { error: 'Could not create artifact' }, 500)

      const storagePath = `${clientId}/${sessionId}/${artifact.id}-${filename}`
      await restUpdate('artifacts', { id: `eq.${artifact.id}` }, { storage_path: storagePath })
      const signed = await createSignedUploadUrl(storagePath)
      return jsonResponse(request, { artifact_id: artifact.id, upload: signed }, 201)
    }

    // ---------------------------------------------------------------
    // POST /sign-download — short-lived signed URL for one artifact.
    // ---------------------------------------------------------------
    if (resource === 'sign-download' && request.method === 'POST') {
      const body = await request.json() as { artifact_id?: string }
      const artifactId = body.artifact_id ?? ''
      if (!UUID_RE.test(artifactId)) return jsonResponse(request, { error: 'artifact_id is required' }, 400)
      const artifacts = await restSelect<ArtifactRow>('artifacts', {
        id: `eq.${artifactId}`,
        select: 'id,session_id,storage_path,filename',
        limit: '1',
      })
      const artifact = artifacts[0]
      if (!artifact) return jsonResponse(request, { error: 'Artifact not found' }, 404)
      // Scope check: the artifact's session must belong to this client.
      const sessions = await restSelect<{ id: string }>('sessions', {
        id: `eq.${artifact.session_id}`,
        client_id: `eq.${clientId}`,
        select: 'id',
        limit: '1',
      })
      if (sessions.length === 0) return jsonResponse(request, { error: 'Artifact not found' }, 404)
      const downloadUrl = await createSignedDownloadUrl(artifact.storage_path)
      return jsonResponse(request, { url: downloadUrl, filename: artifact.filename })
    }

    // ---------------------------------------------------------------
    // GET /artifacts?session_id= — list a session's artifacts.
    // ---------------------------------------------------------------
    if (resource === 'artifacts' && request.method === 'GET') {
      const sessionId = url.searchParams.get('session_id') ?? ''
      if (!UUID_RE.test(sessionId)) return jsonResponse(request, { error: 'session_id is required' }, 400)
      const sessions = await restSelect<{ id: string }>('sessions', {
        id: `eq.${sessionId}`,
        client_id: `eq.${clientId}`,
        select: 'id',
        limit: '1',
      })
      if (sessions.length === 0) return jsonResponse(request, { error: 'Session not found' }, 404)
      const artifacts = await restSelect<ArtifactRow>('artifacts', {
        session_id: `eq.${sessionId}`,
        select: 'id,session_id,storage_path,filename,mime_type,size,created_at',
        order: 'created_at.asc',
      })
      return jsonResponse(request, { artifacts })
    }

    return jsonResponse(request, { error: 'Unknown resource' }, 404)
  } catch (error) {
    console.error('[artifact-api] error:', error instanceof Error ? error.message : error)
    return jsonResponse(request, { error: 'Internal error' }, 500)
  }
})


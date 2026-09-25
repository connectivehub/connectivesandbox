import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import Login from '@/screens/Login'
import { getSession, type ConsoleSession } from '@/data/adapters/auth'

// Code splitting (polish 3): the login screen ships alone; the workspace and
// admin chunks load in parallel during keypad entry (Login warms both on
// mount), so post-login arrival is instant.
const Workspace = lazy(() => import('@/screens/Workspace'))
const Admin = lazy(() => import('@/screens/Admin'))

function ChunkFallback() {
  return <main className="h-dvh bg-white" aria-busy="true" />
}

// Real auth (Phase 5): the session lives in an httpOnly cookie, resolved
// server-side via the auth-code function. On login the client-side gate hands
// the freshly minted session straight up — no extra roundtrip.
function Guard({ role, session, children }: { role: 'admin' | 'client'; session: ConsoleSession | null; children: ReactNode }) {
  if (session?.role !== role) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  // undefined = still resolving the cookie; null = signed out.
  const [session, setSession] = useState<ConsoleSession | null | undefined>(undefined)

  useEffect(() => {
    let active = true
    void getSession().then((resolved) => {
      if (active) setSession(resolved)
    })
    return () => {
      active = false
    }
  }, [])

  if (session === undefined) {
    return <main className="h-dvh bg-ink" aria-busy="true" />
  }

  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Login onAuthenticated={setSession} />} />
        <Route
          path="/admin"
          element={
            <Guard role="admin" session={session}>
              <Suspense fallback={<ChunkFallback />}>
                <Admin />
              </Suspense>
            </Guard>
          }
        />
        <Route
          path="/workspace"
          element={
            <Guard role="client" session={session}>
              <Suspense fallback={<ChunkFallback />}>
                <Workspace />
              </Suspense>
            </Guard>
          }
        />
      </Routes>
    </MotionConfig>
  )
}

export default App

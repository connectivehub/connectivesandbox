import { useEffect, useState, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import Admin from '@/screens/Admin'
import Login from '@/screens/Login'
import Workspace from '@/screens/Workspace'
import { getSession } from '@/data/adapters/auth'

// Real auth (Phase 5): the session lives in an httpOnly cookie, so every
// guarded route resolves it server-side via the auth-code function. Nothing
// about the role is decided in the browser alone.
function RequireRole({ role, children }: { role: 'admin' | 'client'; children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'deny'>('checking')

  useEffect(() => {
    let active = true
    void getSession().then((session) => {
      if (active) setState(session?.role === role ? 'ok' : 'deny')
    })
    return () => {
      active = false
    }
  }, [role])

  if (state === 'checking') {
    return <main className="h-dvh bg-ink" aria-busy="true" />
  }
  if (state === 'deny') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <Admin />
            </RequireRole>
          }
        />
        <Route
          path="/workspace"
          element={
            <RequireRole role="client">
              <Workspace />
            </RequireRole>
          }
        />
      </Routes>
    </MotionConfig>
  )
}

export default App

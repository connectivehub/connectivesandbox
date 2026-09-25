import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { lazy } from 'react'
import { Delete } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { getAccessCodeMap, mintSession, type CodeEntry } from '@/data/adapters/auth'
import type { ConsoleSession } from '@/data/adapters/auth'
import { warmAdminData, warmClientData } from '@/data/warm'

// Code splitting (polish 3): both destination chunks load during keypad
// entry; the matched role's screen renders behind the gate while the session
// mints, so the swap on success is instant.
const Workspace = lazy(() => import('@/screens/Workspace'))
const Admin = lazy(() => import('@/screens/Admin'))

const CODE_LENGTH = 4

export default function Login({ onAuthenticated }: { onAuthenticated: (session: ConsoleSession) => void }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codesRef = useRef<Record<string, CodeEntry> | null>(null)
  const enteringRef = useRef(false)
  // When set, the matched destination renders behind the gate: dimmed,
  // blurred, non-interactive — its data is warming in parallel.
  const [entering, setEntering] = useState<'admin' | 'client' | null>(null)

  useEffect(() => {
    // Warm the code map and both destination chunks the moment the gate shows.
    void getAccessCodeMap().then((map) => {
      codesRef.current = map
    }).catch(() => {
      codesRef.current = null
    })
    void import('@/screens/Workspace')
    void import('@/screens/Admin')
  }, [])

  const submit = useCallback(
    async (candidate: string) => {
      if (enteringRef.current) return
      const map = codesRef.current
      const entry = map !== null ? map[candidate] : undefined
      if (entry === undefined) {
        setCode('')
        setError(
          map === null
            ? 'Access codes unavailable. Try again.'
            : 'Incorrect access code. Try again.',
        )
        setShake(true)
        return
      }
      enteringRef.current = true
      setError(null)
      try {
        const session = await mintSession(entry)
        // Cookie set — mount the destination behind the gate and warm its
        // data in the same tick; the viaCache layer dedupes both.
        setEntering(entry.role === 'admin' ? 'admin' : 'client')
        if (entry.role === 'admin') warmAdminData()
        else warmClientData()
        await new Promise<void>((resolve) => window.setTimeout(resolve, 80))
        onAuthenticated(session)
        navigate(entry.role === 'admin' ? '/admin' : '/workspace', { replace: true })
      } catch (caught) {
        enteringRef.current = false
        setEntering(null)
        setCode('')
        setError(
          caught instanceof Error && caught.message.length > 0
            ? caught.message
            : 'Could not start the session. Try again.',
        )
        setShake(true)
      }
    },
    [navigate, onAuthenticated],
  )

  const press = useCallback(
    (digit: string) => {
      if (enteringRef.current) return
      setError(null)
      setCode((current) => {
        if (current.length >= CODE_LENGTH) return current
        const next = current + digit
        if (next.length === CODE_LENGTH) {
          void submit(next)
        }
        return next
      })
    },
    [submit],
  )

  const backspace = useCallback(() => {
    if (enteringRef.current) return
    setError(null)
    setCode((current) => current.slice(0, -1))
  }, [])

  // Physical keyboard entry mirrors the keypad.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        press(event.key)
      } else if (event.key === 'Backspace') {
        backspace()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press, backspace])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'backspace'] as const

  return (
    <>
      {/* Destination behind the gate: dimmed, blurred, non-interactive. */}
      {entering !== null && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 select-none opacity-60 blur-[2px]"
        >
          <Suspense fallback={<div className="h-full w-full bg-white" />}>
            {entering === 'admin' ? <Admin /> : <Workspace />}
          </Suspense>
        </div>
      )}
      <main
        className={cn(
          'relative z-10 flex h-dvh items-center justify-center overflow-hidden px-6',
          entering !== null ? 'bg-ink/90 backdrop-blur-[2px]' : 'bg-ink',
        )}
      >
        <div className="flex w-full max-w-sm flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Connective Labs
          </p>
          <h1 className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-50">
            Enter your access code
            <span className="block text-accent">to open the console</span>
          </h1>

          <div
            className={shake ? 'animate-shake' : undefined}
            onAnimationEnd={() => setShake(false)}
          >
            {/* Centred on the same axis as the keypad: flex + justify-center. */}
            <div className="mt-10 flex items-center justify-center gap-4" aria-hidden="true">
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-full transition-colors ${
                    index < code.length ? 'bg-accent' : 'border border-slate-600'
                  }`}
                />
              ))}
            </div>
            {error ? (
              <p role="alert" className="mt-4 h-5 text-center text-sm text-slate-400">
                {error}
              </p>
            ) : (
              <p aria-hidden="true" className="mt-4 h-5" />
            )}

            <div className="mt-4 grid grid-cols-3 gap-3" role="group" aria-label="Access code keypad">
              {keys.map((key) => {
                if (key === null) {
                  return <span key="spacer" aria-hidden="true" />
                }
                if (key === 'backspace') {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={backspace}
                      disabled={code.length === 0}
                      aria-label="Delete last digit"
                      className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-700 bg-surface-raised text-slate-50 transition hover:border-accent active:bg-accent active:text-ink disabled:opacity-40"
                    >
                      <Delete size={20} aria-hidden="true" />
                    </button>
                  )
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => press(key)}
                    aria-label={`Digit ${key}`}
                    className="h-16 w-16 rounded-full border border-slate-700 bg-surface-raised text-2xl font-semibold text-slate-50 transition hover:border-accent active:bg-accent active:text-ink"
                  >
                    {key}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

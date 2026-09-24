import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { verifyAccessCode } from '@/data/adapters/auth'

const CODE_LENGTH = 4

export default function Login() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [shake, setShake] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittingRef = useRef(false)

  const submit = useCallback(
    async (candidate: string) => {
      if (submittingRef.current) return
      submittingRef.current = true
      try {
        const role = await verifyAccessCode(candidate)
        navigate(role === 'admin' ? '/admin' : '/workspace')
      } catch {
        setCode('')
        setError('Incorrect access code. Try again.')
        setShake(true)
      } finally {
        submittingRef.current = false
      }
    },
    [navigate],
  )

  const press = useCallback(
    (digit: string) => {
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
    <main className="flex h-dvh items-center justify-center overflow-hidden bg-ink px-6">
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
          <div className="mt-10 flex items-center gap-4" aria-hidden="true">
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
  )
}

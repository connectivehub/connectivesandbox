// Ink top bar shared by the workspace and admin screens. Ink (#091426) is for
// login and the top bar only — the working surfaces below stay white/slate-50.

import { useNavigate } from 'react-router-dom'

import { Eyebrow } from '@/components/ui/Primitives'

export default function AppTopBar({ context }: { context: string }) {
  const navigate = useNavigate()
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-ink px-6">
      <div className="flex items-baseline gap-4">
        <p className="text-sm font-bold tracking-tight text-slate-50">
          Connective<span className="text-accent"> Labs</span>
        </p>
        <span aria-hidden="true" className="h-4 w-px bg-slate-700" />
        <Eyebrow className="text-slate-400">{context}</Eyebrow>
      </div>
      <div className="flex items-center gap-4">
        {/* BACKEND: session user and organisation from Supabase auth in Phase 5. */}
        <p className="hidden text-sm text-slate-400 sm:block">
          Amirah Bte Rahman · CurtainCraft Interiors
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-full border border-slate-700 px-4 py-1.5 text-sm font-semibold text-slate-50 transition hover:border-accent hover:text-accent"
        >
          Sign Out
        </button>
      </div>
    </header>
  )
}

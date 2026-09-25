// Main working area shared by the workspace screen and the admin live preview.
// The dashboard defaults to the side panel on wide viewports and the
// observability banner below the tablet breakpoint (manual toggle wins until
// the next breakpoint crossing). Panel/banner switch animates with
// framer-motion; the surface stays mounted so intake state (chat transcript,
// attachments) never resets. Chat-first specs render viewport-locked: no
// inner scroll on the surface, the chat's message list scrolls instead.
// Decision-ledger failures (confidence-0 rows written by run-workflow) are
// surfaced here — never silently swallowed.

import { AnimatePresence, motion } from 'framer-motion'

import ObservabilityBanner from '@/components/workspace/ObservabilityBanner'
import DashboardPane from '@/components/workspace/DashboardPane'
import IntakeSurface from '@/components/workspace/IntakeSurface'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/state/workspace'

const SWITCH_TRANSITION = { duration: 0.18, ease: 'easeOut' as const }

export default function WorkspaceBody() {
  const { spec, dashboardExpanded, runError } = useWorkspace()
  const chatLocked = spec.intake.components.some((component) => component.type === 'chat')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {runError !== null && (
        <div
          role="alert"
          className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700"
        >
          <span className="font-semibold">Judge failure —</span> {runError} The run was recorded in
          the decision ledger with 0% confidence; nothing was silently substituted.
        </div>
      )}
      <AnimatePresence mode="wait" initial={false}>
        {!dashboardExpanded && (
          <motion.div
            key="banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SWITCH_TRANSITION}
          >
            <ObservabilityBanner />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Working surface"
          className={cn(
            'order-2 min-h-0 flex-1 px-6 lg:order-1 lg:flex-none',
            'py-6',
            chatLocked
              ? 'overflow-hidden py-4'
              : 'scroll-slim overflow-y-auto',
            dashboardExpanded ? 'lg:w-[60%]' : 'lg:w-full',
          )}
        >
          <IntakeSurface />
        </section>
        <AnimatePresence initial={false}>
          {dashboardExpanded && (
            <motion.section
              key="dashboard"
              aria-label="Dashboard"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={SWITCH_TRANSITION}
              className="scroll-slim order-1 min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-slate-50 px-6 py-6 lg:order-2 lg:w-[40%] lg:flex-none lg:border-l lg:border-t-0"
            >
              <DashboardPane />
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

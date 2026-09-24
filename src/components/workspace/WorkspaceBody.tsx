// Main working area shared by the workspace screen and the admin live preview.
// With the dashboard collapsed (default on first land — judges have not run)
// the observability banner sits above a full-width working surface; expanding
// restores the 60/40 two-pane layout, dashboard first below tablet. The
// surface stays mounted across the toggle so intake state (chat transcript,
// attachments) never resets.

import ObservabilityBanner from '@/components/workspace/ObservabilityBanner'
import DashboardPane from '@/components/workspace/DashboardPane'
import IntakeSurface from '@/components/workspace/IntakeSurface'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/state/workspace'

export default function WorkspaceBody() {
  const { dashboardExpanded } = useWorkspace()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!dashboardExpanded && <ObservabilityBanner />}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section
          aria-label="Working surface"
          className={cn(
            'scroll-slim order-2 min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:order-1 lg:flex-none',
            dashboardExpanded ? 'lg:w-[60%]' : 'lg:w-full',
          )}
        >
          <IntakeSurface />
        </section>
        {dashboardExpanded && (
          <section
            aria-label="Dashboard"
            className="scroll-slim order-1 min-h-0 flex-1 overflow-y-auto border-t border-slate-200 bg-slate-50 px-6 py-6 lg:order-2 lg:w-[40%] lg:flex-none lg:border-l lg:border-t-0"
          >
            <DashboardPane />
          </section>
        )}
      </div>
    </div>
  )
}

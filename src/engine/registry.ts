// Fixed component registry: maps the component/panel type strings that can
// appear in a validated WorkflowSpec to React components. No model emits UI
// at runtime — the spec is data, this map is code.
//
// Phase 1: every entry points at a typed placeholder component so the map is
// complete and type-checked. Phase 3 fills in behaviour behind the same keys.

import { lazy, type ComponentType } from 'react'

import type { DashboardPanel, IntakeComponent } from './types'

/** Props every intake renderer receives; implementations narrow internally. */
export interface IntakeComponentViewProps {
  component: IntakeComponent
  disabled?: boolean
}

/** Props every dashboard panel renderer receives; implementations narrow internally. */
export interface DashboardPanelViewProps {
  panel: DashboardPanel
}

type IntakeRegistry = Record<IntakeComponent['type'], ComponentType<IntakeComponentViewProps>>
type DashboardRegistry = Record<DashboardPanel['type'], ComponentType<DashboardPanelViewProps>>

// Each placeholder's props are narrower than the registry entry (they take the
// matching variant), so the lazy import is cast through unknown at the registry
// boundary. Phase 3 keeps the same keys and props contract.
function lazyIntake<P extends IntakeComponentViewProps>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<IntakeComponentViewProps> {
  return lazy(loader) as unknown as ComponentType<IntakeComponentViewProps>
}

function lazyPanel<P extends DashboardPanelViewProps>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<DashboardPanelViewProps> {
  return lazy(loader) as unknown as ComponentType<DashboardPanelViewProps>
}

export const intakeRegistry: IntakeRegistry = {
  file_upload: lazyIntake(() => import('@/components/FileUpload')),
  chat: lazyIntake(() => import('@/components/Chat')),
  button_group: lazyIntake(() => import('@/components/ButtonGroup')),
  text_field: lazyIntake(() => import('@/components/TextField')),
  form: lazyIntake(() => import('@/components/Form')),
}

export const dashboardRegistry: DashboardRegistry = {
  confidence_meter: lazyPanel(() => import('@/components/ConfidenceMeter')),
  analysis: lazyPanel(() => import('@/components/Analysis')),
  monitoring: lazyPanel(() => import('@/components/Monitoring')),
  decision_log: lazyPanel(() => import('@/components/DecisionLog')),
  usage_counter: lazyPanel(() => import('@/components/UsageCounter')),
}

/** Every intake type string the registry knows about. */
export const intakeComponentTypes = Object.keys(intakeRegistry) as IntakeComponent['type'][]

/** Every dashboard panel type string the registry knows about. */
export const dashboardPanelTypes = Object.keys(dashboardRegistry) as DashboardPanel['type'][]

// Phase 1 validation: the Zod schema must accept both fixture WorkflowSpecs
// and reject a deliberately malformed spec. Run with `npm run validate:spec`.

import { safeParseWorkflowSpec } from '../src/engine/schema.ts'
import { documentIntakeReview, photoToQuoteTriage } from '../src/data/fixtures/workflows.ts'
import { decisions } from '../src/data/fixtures/records.ts'

let failures = 0

function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// Both fixtures validate.
const photo = safeParseWorkflowSpec(photoToQuoteTriage)
check('schema accepts fixture: Photo-to-Quote Triage', photo.success)

const documents = safeParseWorkflowSpec(documentIntakeReview)
check('schema accepts fixture: Document Intake Review', documents.success)

// Every component/panel type in the fixtures is covered by the registry keys.
import { dashboardRegistry, intakeRegistry } from '../src/engine/registry.ts'

const intakeTypes = new Set([
  ...photoToQuoteTriage.intake.components.map((c) => c.type),
  ...documentIntakeReview.intake.components.map((c) => c.type),
])
const panelTypes = new Set([
  ...photoToQuoteTriage.dashboard.panels.map((p) => p.type),
  ...documentIntakeReview.dashboard.panels.map((p) => p.type),
])
check(
  'registry covers all fixture intake component types',
  [...intakeTypes].every((type) => type in intakeRegistry),
)
check(
  'registry covers all fixture dashboard panel types',
  [...panelTypes].every((type) => type in dashboardRegistry),
)

// Deliberately malformed specs are rejected.
const missingChoiceOptions = structuredClone(photoToQuoteTriage)
const readinessJudge = missingChoiceOptions.judges.find((j) => j.id === 'pricing-readiness')
if (readinessJudge && 'options' in readinessJudge) {
  delete readinessJudge.options
}
check(
  'schema rejects choice judge without options',
  !safeParseWorkflowSpec(missingChoiceOptions).success,
)

const badIntakeType = structuredClone(documentIntakeReview)
badIntakeType.intake.components.push({
  type: 'video_upload',
  id: 'bad',
  label: 'Bad',
} as unknown as (typeof badIntakeType.intake.components)[number])
check('schema rejects unknown intake component type', !safeParseWorkflowSpec(badIntakeType).success)

const badThreshold = structuredClone(photoToQuoteTriage)
badThreshold.judges[0]!.thresholds.auto = 1.5
check('schema rejects threshold outside 0..1', !safeParseWorkflowSpec(badThreshold).success)

const emptyName = structuredClone(documentIntakeReview)
;(emptyName as { name: string }).name = ''
check('schema rejects empty workflow name', !safeParseWorkflowSpec(emptyName).success)

// Fixture decision rows must span all three disposition bands so Phase 3 can
// show green/amber/red without interaction.
const dispositions = new Set(decisions.map((d) => d.disposition))
check(
  'fixture decision rows include auto, review, and escalated',
  ['auto', 'review', 'escalated'].every((d) => dispositions.has(d as 'auto' | 'review' | 'escalated')),
)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll checks passed.')

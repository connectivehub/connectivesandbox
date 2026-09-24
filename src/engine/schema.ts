// Zod schema mirroring src/engine/types.ts (frozen). Validates an untrusted
// WorkflowSpec emitted by an admin LLM before the fixed component registry
// renders it. src/engine/ stays pure: Zod is a parsing library, not a network
// or data-layer dependency.

import { z } from 'zod'

import type { WorkflowSpec } from './types'

export const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
})

export const formFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'select']),
  required: z.boolean().optional(),
  options: z.array(optionSchema).optional(),
})

export const intakeComponentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('file_upload'),
    id: z.string().min(1),
    label: z.string().min(1),
    accept: z.array(z.string().min(1)).min(1),
    multiple: z.boolean(),
    instructions: z.string().min(1),
  }),
  z.object({
    type: z.literal('chat'),
    id: z.string().min(1),
    placeholder: z.string().min(1),
    opening_message: z.string().min(1),
  }),
  z.object({
    type: z.literal('button_group'),
    id: z.string().min(1),
    label: z.string().min(1),
    options: z.array(optionSchema).min(1),
    multi: z.boolean(),
  }),
  z.object({
    type: z.literal('text_field'),
    id: z.string().min(1),
    label: z.string().min(1),
    multiline: z.boolean(),
  }),
  z.object({
    type: z.literal('form'),
    id: z.string().min(1),
    fields: z.array(formFieldSchema).min(1),
  }),
])

export const thresholdSchema = z.object({
  auto: z.number().min(0).max(1),
  review: z.number().min(0).max(1),
})

export const judgeSchema = z.discriminatedUnion('question_type', [
  z.object({
    id: z.string().min(1),
    state_from: z.array(z.string()),
    question: z.string().min(1),
    question_type: z.literal('choice'),
    // For every `choice` judge, options is required.
    options: z.array(z.string().min(1)).min(1),
    thresholds: thresholdSchema,
  }),
  z.object({
    id: z.string().min(1),
    state_from: z.array(z.string()),
    question: z.string().min(1),
    question_type: z.literal('boolean'),
    options: z.array(z.string().min(1)).optional(),
    thresholds: thresholdSchema,
  }),
  z.object({
    id: z.string().min(1),
    state_from: z.array(z.string()),
    question: z.string().min(1),
    question_type: z.literal('scalar'),
    options: z.array(z.string().min(1)).optional(),
    thresholds: thresholdSchema,
  }),
])

export const dashboardPanelSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('confidence_meter'),
    id: z.string().min(1),
    judge_id: z.string().min(1),
    label: z.string().min(1),
  }),
  z.object({
    type: z.literal('analysis'),
    id: z.string().min(1),
    title: z.string().min(1),
    source: z.enum(['llm', 'judges']),
  }),
  z.object({
    type: z.literal('monitoring'),
    id: z.string().min(1),
    metrics: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal('decision_log'),
    id: z.string().min(1),
    limit: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('usage_counter'),
    id: z.string().min(1),
    label: z.string().min(1),
  }),
])

export const workflowSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  intake: z.object({
    components: z.array(intakeComponentSchema),
  }),
  judges: z.array(judgeSchema),
  dashboard: z.object({
    panels: z.array(dashboardPanelSchema),
  }),
})

export type ValidatedWorkflowSpec = z.infer<typeof workflowSpecSchema>

// Compile-time check: a spec that passes the schema is assignable to the
// frozen WorkflowSpec type. If this drifts, the schema no longer mirrors
// types.ts and must be fixed.
type SchemaMatchesFrozenTypes = ValidatedWorkflowSpec extends WorkflowSpec ? true : false
const schemaMatchesFrozenTypes: SchemaMatchesFrozenTypes = true
void schemaMatchesFrozenTypes

export function parseWorkflowSpec(input: unknown): ValidatedWorkflowSpec {
  return workflowSpecSchema.parse(input)
}

export function safeParseWorkflowSpec(input: unknown) {
  return workflowSpecSchema.safeParse(input)
}

// Fixture conversation for the admin workflow-builder chat. The final
// assistant message carries a valid WorkflowSpec JSON the reviewer can load
// into the live preview. BACKEND: the real builder LLM lands in Phase 6.

import type { WorkflowSpec } from '@/engine/types'

export interface BuilderChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Raw spec payload attached to assistant messages that propose a workflow. */
  spec?: WorkflowSpec
}

/** Third fixture spec: exercises the form intake component end to end. */
export const siteVisitBookingSpec: WorkflowSpec = {
  name: 'Site Visit Booking',
  description:
    'Collect site-visit details from the client and judge whether the visit can be booked straight away or needs more information first.',
  intake: {
    components: [
      {
        type: 'form',
        id: 'contact_details',
        fields: [
          { id: 'contact_name', label: 'Contact name', type: 'text', required: true },
          { id: 'contact_number', label: 'Contact number', type: 'text', required: true },
          {
            id: 'preferred_slot',
            label: 'Preferred timeslot',
            type: 'select',
            required: true,
            options: [
              { value: 'weekday_morning', label: 'Weekday morning' },
              { value: 'weekday_afternoon', label: 'Weekday afternoon' },
              { value: 'saturday', label: 'Saturday' },
            ],
          },
          { id: 'access_notes', label: 'Access notes', type: 'textarea' },
        ],
      },
      { type: 'text_field', id: 'job_address', label: 'Job address', multiline: false },
      {
        type: 'button_group',
        id: 'property_type',
        label: 'Property type',
        multi: false,
        options: [
          { value: 'hdb', label: 'HDB' },
          { value: 'condo', label: 'Condominium' },
          { value: 'landed', label: 'Landed' },
          { value: 'commercial', label: 'Commercial' },
        ],
      },
    ],
  },
  judges: [
    {
      id: 'booking-readiness',
      state_from: ['contact_details', 'job_address', 'property_type'],
      question: 'Can the site visit be booked straight away?',
      question_type: 'choice',
      options: ['bookable', 'reschedule', 'needs-info'],
      thresholds: { auto: 0.9, review: 0.65 },
    },
    {
      id: 'access-check',
      state_from: ['contact_details'],
      question: 'Are the access notes sufficient for the surveyor?',
      question_type: 'boolean',
      thresholds: { auto: 0.85, review: 0.5 },
    },
  ],
  dashboard: {
    panels: [
      { type: 'confidence_meter', id: 'meter-booking', judge_id: 'booking-readiness', label: 'Booking readiness' },
      { type: 'confidence_meter', id: 'meter-access', judge_id: 'access-check', label: 'Access confidence' },
      { type: 'analysis', id: 'analysis-booking', title: 'Booking summary', source: 'judges' },
      { type: 'monitoring', id: 'monitoring-visits', metrics: ['visits_booked', 'average_confidence'] },
      { type: 'decision_log', id: 'log-booking', limit: 20 },
      { type: 'usage_counter', id: 'usage-booking', label: 'Judge calls this billing period' },
    ],
  },
}

export const builderConversation: BuilderChatMessage[] = [
  {
    id: 'bc_001',
    role: 'user',
    content:
      'Build a workflow: the client submits contact details and address, and a judge decides if we can book a site visit straight away.',
  },
  {
    id: 'bc_002',
    role: 'assistant',
    content:
      'Draft ready — Site Visit Booking. Intake collects contact details, address, and property type; one judge scores booking readiness, another checks the access notes. Load the spec into the preview.',
    spec: siteVisitBookingSpec,
  },
]

/** Canned assistant acknowledgement while the builder runs on fixtures. */
export const builderAckReply =
  'Noted. Spec generation runs on fixtures this phase — refine the spec as raw JSON in the preview pane.'

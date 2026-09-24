// Typed fixture WorkflowSpecs. These are validated by src/engine/schema.ts in
// scripts/validate-fixtures.ts and served by src/data/adapters/workflows.ts.

import type { WorkflowSpec } from '@/engine/types'

/** Fixture 1: Photo-to-Quote Triage (curtains / sofas / carpets business). */
export const photoToQuoteTriage: WorkflowSpec = {
  name: 'Photo-to-Quote Triage',
  description:
    'Customer uploads photos of curtains, sofas, or carpets; judges triage whether the job is quotable straight away, needs one follow-up question, or needs a site visit, and classify the job archetype.',
  intake: {
    components: [
      {
        type: 'chat',
        id: 'intake_chat',
        placeholder: 'Describe the job — room, item, and any deadlines…',
        opening_message:
          'Good day! Drop your photos here and tell us a little about the job. We will come back with a quote or one quick question.',
      },
    ],
  },
  judges: [
    {
      id: 'pricing-readiness',
      state_from: ['intake_chat'],
      question: 'Are the uploaded photos legible enough to price this job?',
      question_type: 'choice',
      options: ['quotable', 'one-ask', 'site-visit'],
      thresholds: { auto: 0.9, review: 0.5 },
    },
    {
      id: 'job-archetype',
      state_from: ['intake_chat'],
      question: 'Which job archetype does this request belong to?',
      question_type: 'choice',
      options: ['curtain', 'blind', 'carpet', 'rug', 'sofa', 'mattress', 'mixed'],
      thresholds: { auto: 0.9, review: 0.6 },
    },
    {
      id: 'follow-up-question',
      state_from: ['intake_chat'],
      question: 'Which ONE follow-up question would unblock this job?',
      question_type: 'choice',
      options: ['window_width', 'fabric_type', 'ceiling_height', 'room_access', 'budget_range'],
      thresholds: { auto: 0.85, review: 0.5 },
    },
  ],
  dashboard: {
    panels: [
      { type: 'confidence_meter', id: 'meter-readiness', judge_id: 'pricing-readiness', label: 'Pricing readiness' },
      { type: 'confidence_meter', id: 'meter-archetype', judge_id: 'job-archetype', label: 'Archetype confidence' },
      { type: 'confidence_meter', id: 'meter-follow-up', judge_id: 'follow-up-question', label: 'Follow-up confidence' },
      { type: 'analysis', id: 'analysis-summary', title: 'Triage summary', source: 'judges' },
      { type: 'decision_log', id: 'log-triage', limit: 20 },
      { type: 'usage_counter', id: 'usage-triage', label: 'Judge calls this billing period' },
    ],
  },
}

/** Fixture 2: Document Intake Review (back-office document processing). */
export const documentIntakeReview: WorkflowSpec = {
  name: 'Document Intake Review',
  description:
    'Staff upload a document, pick its class, and add free-text notes; judges confirm the classification and whether the document set is complete.',
  intake: {
    components: [
      {
        type: 'file_upload',
        id: 'documents',
        label: 'Documents to review',
        accept: ['application/pdf', 'image/png', 'image/jpeg'],
        multiple: true,
        instructions: 'Upload the complete document set. Scans must be right way up and readable.',
      },
      {
        type: 'button_group',
        id: 'doc_class',
        label: 'What kind of document is this?',
        options: [
          { value: 'invoice', label: 'Invoice' },
          { value: 'contract', label: 'Contract' },
          { value: 'receipt', label: 'Receipt' },
          { value: 'correspondence', label: 'Correspondence' },
          { value: 'other', label: 'Other' },
        ],
        multi: false,
      },
      {
        type: 'text_field',
        id: 'summary_notes',
        label: 'Reviewer notes',
        multiline: true,
      },
    ],
  },
  judges: [
    {
      id: 'document-classification',
      state_from: ['documents', 'doc_class', 'summary_notes'],
      question: 'Does the document content match the selected classification?',
      question_type: 'choice',
      options: ['invoice', 'contract', 'receipt', 'correspondence', 'other'],
      thresholds: { auto: 0.9, review: 0.5 },
    },
    {
      id: 'document-completeness',
      state_from: ['documents', 'summary_notes'],
      question: 'Is the document set complete and legible?',
      question_type: 'choice',
      options: ['complete', 'missing-pages', 'illegible', 'wrong-document'],
      thresholds: { auto: 0.9, review: 0.55 },
    },
  ],
  dashboard: {
    panels: [
      { type: 'confidence_meter', id: 'meter-classification', judge_id: 'document-classification', label: 'Classification confidence' },
      { type: 'confidence_meter', id: 'meter-completeness', judge_id: 'document-completeness', label: 'Completeness confidence' },
      { type: 'monitoring', id: 'monitoring-intake', metrics: ['documents_processed', 'review_rate', 'average_confidence'] },
      { type: 'decision_log', id: 'log-intake', limit: 50 },
    ],
  },
}

export const workflowSpecs: Record<string, WorkflowSpec> = {
  'photo-to-quote-triage': photoToQuoteTriage,
  'document-intake-review': documentIntakeReview,
}

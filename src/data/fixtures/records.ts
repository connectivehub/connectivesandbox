// Typed fixture data: clients, users, sessions, decision rows, chat history,
// usage. Decision rows deliberately include confidences above the auto
// threshold, in the amber review band, and below review (escalated) so every
// disposition is visible without interaction in Phase 3.

import type { ChatMessage, Client, DecisionRecord, SessionRecord, UsageSnapshot, User } from '@/data/types'

export const users: User[] = [
  {
    id: 'usr_001',
    email: 'amirah@curtaincraft.example',
    name: 'Amirah Bte Rahman',
    role: 'owner',
  },
  {
    id: 'usr_002',
    email: 'dequan@curtaincraft.example',
    name: 'Dequan Tan',
    role: 'admin',
  },
  {
    id: 'usr_003',
    email: 'meilin@curtaincraft.example',
    name: 'Mei Lin Chan',
    role: 'agent',
  },
]

export const clients: Client[] = [
  {
    id: 'clt_001',
    name: 'CurtainCraft Interiors',
    slug: 'curtaincraft',
    created_at: '2025-11-02T09:15:00+08:00',
  },
  {
    id: 'clt_002',
    name: 'Meridian Claims Services',
    slug: 'meridian-claims',
    created_at: '2025-12-01T14:40:00+08:00',
  },
]

export const sessions: SessionRecord[] = [
  {
    id: 'ses_1001',
    client_id: 'clt_001',
    workflow_id: 'photo-to-quote-triage',
    title: 'Living room blackout curtains — Bukit Timah',
    status: 'judged',
    created_at: '2026-01-05T10:04:00+08:00',
  },
  {
    id: 'ses_1002',
    client_id: 'clt_001',
    workflow_id: 'photo-to-quote-triage',
    title: 'L-shaped sofa reupholstery — Punggol',
    status: 'review',
    created_at: '2026-01-05T11:26:00+08:00',
  },
  {
    id: 'ses_1003',
    client_id: 'clt_001',
    workflow_id: 'photo-to-quote-triage',
    title: 'Bedroom carpet deep clean — Jurong East',
    status: 'review',
    created_at: '2026-01-06T09:51:00+08:00',
  },
  {
    id: 'ses_2001',
    client_id: 'clt_002',
    workflow_id: 'document-intake-review',
    title: 'Motor claim invoice bundle — Jan 2026',
    status: 'judged',
    created_at: '2026-01-06T14:12:00+08:00',
  },
  {
    id: 'ses_2002',
    client_id: 'clt_002',
    workflow_id: 'document-intake-review',
    title: 'Contract renewal pack — harbourfront',
    status: 'review',
    created_at: '2026-01-07T08:33:00+08:00',
  },
]

// Decision rows span the green (>= auto), amber (>= review), and red
// (< review) bands for both fixtures' judges.
export const decisions: DecisionRecord[] = [
  {
    id: 'dec_0001',
    session_id: 'ses_1001',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'pricing-readiness',
    question: 'Are the uploaded photos legible enough to price this job?',
    answer: 'quotable',
    confidence: 0.94,
    disposition: 'auto',
    created_at: '2026-01-05T10:05:12+08:00',
  },
  {
    id: 'dec_0002',
    session_id: 'ses_1001',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'job-archetype',
    question: 'Which job archetype does this request belong to?',
    answer: 'curtain',
    confidence: 0.91,
    disposition: 'auto',
    created_at: '2026-01-05T10:05:13+08:00',
  },
  {
    id: 'dec_0003',
    session_id: 'ses_1002',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'pricing-readiness',
    question: 'Are the uploaded photos legible enough to price this job?',
    answer: 'one-ask',
    confidence: 0.62,
    disposition: 'review',
    created_at: '2026-01-05T11:27:41+08:00',
  },
  {
    id: 'dec_0004',
    session_id: 'ses_1002',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'job-archetype',
    question: 'Which job archetype does this request belong to?',
    answer: 'sofa',
    confidence: 0.58,
    disposition: 'review',
    created_at: '2026-01-05T11:27:42+08:00',
  },
  {
    id: 'dec_0005',
    session_id: 'ses_1003',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'pricing-readiness',
    question: 'Are the uploaded photos legible enough to price this job?',
    answer: 'site-visit',
    confidence: 0.31,
    disposition: 'escalated',
    created_at: '2026-01-06T09:52:08+08:00',
  },
  {
    id: 'dec_0006',
    session_id: 'ses_1003',
    workflow_id: 'photo-to-quote-triage',
    judge_id: 'job-archetype',
    question: 'Which job archetype does this request belong to?',
    answer: 'carpet',
    confidence: 0.44,
    disposition: 'escalated',
    created_at: '2026-01-06T09:52:09+08:00',
  },
  {
    id: 'dec_0007',
    session_id: 'ses_2001',
    workflow_id: 'document-intake-review',
    judge_id: 'document-classification',
    question: 'Does the document content match the selected classification?',
    answer: 'invoice',
    confidence: 0.97,
    disposition: 'auto',
    created_at: '2026-01-06T14:13:20+08:00',
  },
  {
    id: 'dec_0008',
    session_id: 'ses_2001',
    workflow_id: 'document-intake-review',
    judge_id: 'document-completeness',
    question: 'Is the document set complete and legible?',
    answer: 'complete',
    confidence: 0.9,
    disposition: 'auto',
    created_at: '2026-01-06T14:13:21+08:00',
  },
  {
    id: 'dec_0009',
    session_id: 'ses_2002',
    workflow_id: 'document-intake-review',
    judge_id: 'document-classification',
    question: 'Does the document content match the selected classification?',
    answer: 'contract',
    confidence: 0.71,
    disposition: 'review',
    created_at: '2026-01-07T08:34:55+08:00',
  },
  {
    id: 'dec_0010',
    session_id: 'ses_2002',
    workflow_id: 'document-intake-review',
    judge_id: 'document-completeness',
    question: 'Is the document set complete and legible?',
    answer: 'missing-pages',
    confidence: 0.39,
    disposition: 'escalated',
    created_at: '2026-01-07T08:34:56+08:00',
  },
]

export const chatMessages: ChatMessage[] = [
  {
    id: 'msg_0001',
    session_id: 'ses_1001',
    role: 'assistant',
    content: 'Good day! Upload your photos and tell us a little about the job. We will come back with a quote or one quick question.',
    created_at: '2026-01-05T10:04:05+08:00',
  },
  {
    id: 'msg_0002',
    session_id: 'ses_1001',
    role: 'user',
    content: 'Blackout curtains for the living room, floor to ceiling, two windows.',
    created_at: '2026-01-05T10:04:38+08:00',
  },
  {
    id: 'msg_0003',
    session_id: 'ses_1002',
    role: 'assistant',
    content: 'Good day! Upload your photos and tell us a little about the job. We will come back with a quote or one quick question.',
    created_at: '2026-01-05T11:26:02+08:00',
  },
  {
    id: 'msg_0004',
    session_id: 'ses_1002',
    role: 'user',
    content: 'L-shaped sofa, fabric is pilling at the seats. Photos attached.',
    created_at: '2026-01-05T11:26:47+08:00',
  },
]

export const usage: UsageSnapshot[] = [
  { client_id: 'clt_001', period: '2026-01', sessions: 128, judge_calls: 384, tokens: 412_500 },
  { client_id: 'clt_002', period: '2026-01', sessions: 61, judge_calls: 122, tokens: 198_300 },
]

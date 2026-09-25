// Judge service errors. A judge never returns free text into the UI: when a
// response cannot be parsed into the JudgeAnswer shape, the provider throws a
// JudgeParseError carrying the RAW response so run-workflow can persist it on
// confidence-0 decisions rows and the UI can surface the failure. There is no
// silent LLM fallback for a judgement — ever.

export class JudgeParseError extends Error {
  /** The raw provider response body, for the decision-ledger failure row. */
  readonly rawResponse: string
  /** The question ids we were asking when parsing failed. */
  readonly questionIds: string[]

  constructor(message: string, rawResponse: string, questionIds: string[]) {
    super(message)
    this.name = 'JudgeParseError'
    this.rawResponse = rawResponse
    this.questionIds = questionIds
  }
}

export class JudgeTransportError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'JudgeTransportError'
    this.status = status
  }
}

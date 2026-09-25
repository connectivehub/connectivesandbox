// Stick-to-bottom scrolling for chat transcripts (polish 4): the view stays
// pinned to the newest message on send, on streamed tokens, and on history
// load. If the user deliberately scrolls up, auto-sticking pauses until they
// return to the bottom — standard chat behaviour.

import { useCallback, useRef } from 'react'

/** Distance from the bottom (px) inside which the view counts as "at the bottom". */
const BOTTOM_THRESHOLD = 64

export function useStickToBottom() {
  const ref = useRef<HTMLDivElement>(null)
  const stuckRef = useRef(true)

  const onScroll = useCallback(() => {
    const el = ref.current
    if (el === null) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stuckRef.current = distance < BOTTOM_THRESHOLD
  }, [])

  /** Pin to the newest message — a no-op while the user has scrolled up. */
  const stick = useCallback(() => {
    const el = ref.current
    if (el === null || !stuckRef.current) return
    el.scrollTop = el.scrollHeight
  }, [])

  return { ref, onScroll, stick }
}

// WhatsApp-style typing indicator (polish 4): three animated dots in an
// incoming bubble on the left, shown while the model is generating and
// replaced by the streamed reply as tokens arrive. Reduced motion: a static
// "…" bubble instead of the animation.

export function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div
        role="status"
        aria-label="Assistant is typing"
        className="bubble-tail-in relative rounded-lg rounded-tl-none border border-slate-100 bg-white px-3.5 py-3 text-sm shadow-sm"
      >
        <span className="typing-dots" aria-hidden="true">
          <i className="typing-dot" />
          <i className="typing-dot" />
          <i className="typing-dot" />
        </span>
        <span className="typing-static text-slate-400" aria-hidden="true">
          …
        </span>
      </div>
    </div>
  )
}

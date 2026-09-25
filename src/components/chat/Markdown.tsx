// Brand-styled markdown renderer for model replies (polish 4). react-markdown
// (captain-approved dependency) parses the markdown; raw HTML is never
// rendered (no rehype-raw), so output is sanitised by construction. Styles
// ride the brand primitives: slate neutrals, small ink headings, mono stack
// for code — the renderer styles content, it adds no chrome.

import ReactMarkdown, { type Components } from 'react-markdown'

import { cn } from '@/lib/utils'

const components: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-slate-400">{children}</del>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-accent underline underline-offset-2"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: ({ children }) => (
    <h1 className="mt-2.5 text-sm font-bold tracking-tight text-ink first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2.5 text-sm font-bold tracking-tight text-ink first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 text-sm font-semibold tracking-tight text-ink first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2 text-sm font-semibold text-ink first:mt-0">{children}</h4>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2 text-xs font-semibold text-ink first:mt-0">{children}</h5>
  ),
  h6: ({ children }) => (
    <h6 className="mt-2 text-xs font-semibold text-slate-500 first:mt-0">{children}</h6>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-accent/50 pl-3 text-slate-500">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = typeof className === 'string' && className.includes('language-')
    if (isBlock) {
      return (
        <code className={cn('font-mono text-xs leading-relaxed text-slate-100', className)} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-ink"
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="scroll-slim my-1.5 overflow-x-auto rounded-lg bg-surface-dark p-3 first:mt-0 last:mb-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-2 border-slate-200" />,
  table: ({ children }) => (
    <div className="scroll-slim my-1.5 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 px-2 py-1 text-left font-semibold text-ink">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 px-2 py-1 align-top">{children}</td>
  ),
}

/** Markdown content for a chat bubble, styled to the brand. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('break-words text-sm leading-relaxed [overflow-wrap:anywhere]', className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  )
}

// Small display helpers shared by the workspace and admin screens.

/** 'one-ask' -> 'one ask', 'window_width' -> 'window width', booleans -> Yes/No. */
export function humaniseValue(value: string): string {
  if (value === 'true') return 'Yes'
  if (value === 'false') return 'No'
  return value.replace(/[-_]+/g, ' ')
}

export function formatAnswerValue(value: string | boolean | number): string {
  return humaniseValue(String(value))
}

export function formatPercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-SG', { hour12: false })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-SG')
}

/** Compact units for metric tiles: 1284 -> 1.3k, 37 -> 37. */
export function formatCountCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return String(value)
}

/** Deterministic pseudo-random series for fixture sparklines. */
export function trendFromSeed(seed: string, points = 12): number[] {
  let state = 0
  for (const char of seed) state = (state * 31 + char.charCodeAt(0)) % 997
  const series: number[] = []
  for (let index = 0; index < points; index += 1) {
    state = (state * 137 + 71) % 997
    series.push(20 + (state % 80))
  }
  return series
}

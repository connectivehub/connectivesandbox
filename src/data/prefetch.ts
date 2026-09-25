// Read-through promise cache for initial screen loads (polish 3). The login
// gate warms the destination screen's data while the session mints, so the
// post-login mount resolves from this cache instantly. Any mutation drops the
// whole cache — reads go to the network again and re-warm.

const cache = new Map<string, Promise<unknown>>()

/** Read `loader()` through the cache; failures evict their entry. */
export function viaCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = cache.get(key) as Promise<T> | undefined
  if (existing !== undefined) return existing
  const promise = loader().catch((error: unknown) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  return promise
}

/** Drop every cached read — called after any mutation. */
export function invalidateReads(): void {
  cache.clear()
}

/** Fire-and-forget warm of one cached read. */
export function warm(key: string, loader: () => Promise<unknown>): void {
  void viaCache(key, loader).catch(() => {
    // Warms never surface errors; the real read will retry.
  })
}

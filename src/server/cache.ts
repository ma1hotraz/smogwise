interface Entry<V> {
  value: V;
  expiresAt: number;
}

/**
 * Small LRU cache with a TTL and in-flight de-duplication: concurrent loads of the same key share
 * one promise, so a burst of identical requests makes one upstream or model call. Map iteration
 * order doubles as recency order, so no dependency is needed. `now` is injectable for tests.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly inflight = new Map<string, Promise<V>>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Fresh cached value, or undefined (expired entries are dropped). */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) {
      return undefined;
    }
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Stores a value, evicting the least recently used entries beyond the limit. */
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) {
        break;
      }
      this.entries.delete(oldest);
    }
  }

  /**
   * Returns the cached value or runs `loader` once per key at a time. Only values that
   * `shouldCache` accepts are stored (e.g. not fallbacks), so a failure is retried next time.
   */
  async load(
    key: string,
    loader: () => Promise<V>,
    shouldCache: (value: V) => boolean = () => true,
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }
    const promise = loader()
      .then((value) => {
        if (shouldCache(value)) {
          this.set(key, value);
        }
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  get size(): number {
    return this.entries.size;
  }
}

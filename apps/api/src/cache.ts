import type { DataSection } from '@brevo-miniapp/contracts';

interface Entry { data?: unknown; updatedAt?: number; failedAt?: number; pending?: Promise<DataSection<unknown>> }
export class DataCache {
  private entries = new Map<string, Entry>();
  constructor(private now: () => number = Date.now, private ttl = 60_000, private staleLimit = 15 * 60_000) {}
  async get<T>(key: string, load: () => Promise<T>): Promise<DataSection<T>> {
    let entry = this.entries.get(key);
    if (!entry) {
      // Les dates formen part de les claus. Limitem també la retenció de períodes antics.
      for (const [id, item] of this.entries) if (!item.pending && this.now() - (item.updatedAt ?? item.failedAt ?? 0) > this.staleLimit) this.entries.delete(id);
      if (this.entries.size >= 100) this.entries.delete(this.entries.keys().next().value!);
      entry = {};
      this.entries.set(key, entry);
    }
    const selected = entry;
    const result = (status: DataSection<T>['status']): DataSection<T> => ({
      status, data: status === 'unavailable' ? null : selected.data as T,
      updatedAt: status === 'unavailable' ? null : new Date(selected.updatedAt!).toISOString(),
      error: status === 'fresh' ? null : 'BREVO_UNAVAILABLE',
    });
    if (selected.updatedAt !== undefined && this.now() - selected.updatedAt < this.ttl) return result('fresh');
    if (selected.pending) return selected.pending as Promise<DataSection<T>>;
    const fallback = () => result(selected.updatedAt !== undefined && this.now() - selected.updatedAt < this.staleLimit ? 'stale' : 'unavailable');
    if (selected.failedAt !== undefined && this.now() - selected.failedAt < 10_000) return fallback();
    const pending = (async () => {
      try {
        const data = await load();
        selected.data = data;
        selected.updatedAt = this.now();
        delete selected.failedAt;
        return result('fresh');
      } catch {
        selected.failedAt = this.now();
        return fallback();
      } finally { delete selected.pending; }
    })();
    selected.pending = pending;
    return pending;
  }
}

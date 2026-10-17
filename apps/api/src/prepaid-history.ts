import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { DataSection, PrepaidForecast, Quota } from '@brevo-miniapp/contracts';
import type { PrivateConfig } from './private-config.js';
import { readPrivateJson, writePrivateJson } from './private-json.js';

const DAY = 86_400_000, CONTEXT = 'brevo-miniapp-prepaid-history-v1';
interface Sample { at: number; available: number }
type History = Record<string, Sample[]>;
function envelope(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new Error();
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join() !== 'ciphertext,iv,tag,version' || value.version !== 1 ||
    typeof value.iv !== 'string' || !/^[a-f0-9]{24}$/.test(value.iv) || typeof value.tag !== 'string' || !/^[a-f0-9]{32}$/.test(value.tag) ||
    typeof value.ciphertext !== 'string' || !/^[\w-]+$/.test(value.ciphertext)) throw new Error();
  return value as { version: 1; iv: string; tag: string; ciphertext: string };
}
function validate(raw: unknown): History {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error();
  const data = raw as History;
  if (Object.keys(data).length > 25) throw new Error();
  for (const [key, samples] of Object.entries(data)) {
    if (!/^[a-zA-Z0-9-]{1,64}:[a-f0-9]{16}$/.test(key) || !Array.isArray(samples) || samples.length > 60) throw new Error();
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]!;
      if (!sample || Object.keys(sample).sort().join() !== 'at,available' || !Number.isSafeInteger(sample.at) || sample.at < 0 ||
        !Number.isSafeInteger(sample.available) || sample.available < 0 || i > 0 && (sample.at <= samples[i - 1]!.at || sample.available > samples[i - 1]!.available)) throw new Error();
    }
  }
  return data;
}
export function prepaidCredits(quota: Quota | null) {
  return quota?.regime === 'prepaid' ? quota.available : quota?.regime === 'subscription' ? quota.prepaidAvailable : null;
}
const result = (status: PrepaidForecast['status'], days = 0, updatedAt: string | null = null): PrepaidForecast =>
  ({ status, estimatedAt: null, averagePerDay: null, observationDays: days, updatedAt });

export class PrepaidHistory {
  private data: History = {};
  private queue = Promise.resolve();
  private frozen = false;
  private writable = true;
  private constructor(private file: string, private key: Buffer, private now: () => number) {}
  static async open(config: PrivateConfig, now: () => number = Date.now) {
    if (!config.auth || !config.workspaceFile) return undefined;
    const history = new PrepaidHistory(join(dirname(config.workspaceFile), 'prepaid-history.sealed.json'),
      Buffer.from(hkdfSync('sha256', config.auth.sessionSecret, '', CONTEXT, 32)), now);
    try {
      const stored = await readPrivateJson(history.file, envelope, 262144);
      if (stored) {
        const decrypt = createDecipheriv('aes-256-gcm', history.key, Buffer.from(stored.iv, 'hex'));
        decrypt.setAAD(Buffer.from(CONTEXT)); decrypt.setAuthTag(Buffer.from(stored.tag, 'hex'));
        history.data = validate(JSON.parse(Buffer.concat([decrypt.update(Buffer.from(stored.ciphertext, 'base64url')), decrypt.final()]).toString('utf8')));
      }
    } catch { history.frozen = true; history.writable = false; } // Un històric avariat no bloqueja l'accés ni se sobreescriu.
    return history;
  }
  record(key: string, quota: DataSection<Quota>, currentKeys: string[]) {
    const work = this.queue.then(async () => {
      if (this.frozen || quota.status !== 'fresh' || !quota.updatedAt) return;
      const at = Date.parse(quota.updatedAt), available = prepaidCredits(quota.data);
      if (!Number.isSafeInteger(at) || at > this.now() || this.now() - at > 900000) return;
      const draft = structuredClone(this.data);
      for (const old of Object.keys(draft)) if (!currentKeys.includes(old)) delete draft[old];
      const previous = draft[key] ?? [], last = previous.at(-1);
      if (last && at <= last.at) return; // Cache o rellotge enrere: no crea consum.
      if (available === null) delete draft[key];
      else {
        // Compra, canvi de règim o interrupció llarga: comença una sèrie nova.
        let samples = !last || available > last.available || at - last.at > 36 * 3600000 ? [] : previous.filter(sample => at - sample.at <= 29 * DAY);
        const sample = { at, available };
        if (samples.length >= 2 && Math.floor(samples.at(-2)!.at / DAY) === Math.floor(at / DAY)) samples[samples.length - 1] = sample;
        else samples.push(sample); // Primera i última lectura de cada dia UTC, màxim 60.
        draft[key] = samples.slice(-60);
      }
      if (JSON.stringify(draft) === JSON.stringify(this.data)) return;
      try {
        const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv); cipher.setAAD(Buffer.from(CONTEXT));
        const ciphertext = Buffer.concat([cipher.update(JSON.stringify(validate(draft))), cipher.final()]);
        await writePrivateJson(this.file, { version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('base64url') }, envelope, 262144);
        this.data = draft; this.writable = true;
      } catch { this.writable = false; }
    });
    this.queue = work.catch(() => { this.writable = false; });
    return this.queue;
  }
  forecast(key: string, quota: DataSection<Quota>): PrepaidForecast {
    const at = Date.parse(quota.updatedAt ?? '');
    if (quota.status !== 'fresh' || !Number.isSafeInteger(at) || at > this.now() || this.now() - at > 900000) return result('unavailable');
    const available = prepaidCredits(quota.data);
    if (available === null) return result('not-applicable');
    if (available === 0) return result('exhausted', 0, quota.updatedAt);
    if (!this.writable) return result('unavailable');
    const samples = this.data[key] ?? [], last = samples.at(-1), first = samples[0];
    if (!last || !first || last.at !== at || last.available !== available) return result('collecting');
    const days = (last.at - first.at) / DAY;
    if (days < 7 || new Set(samples.map(sample => Math.floor(sample.at / DAY))).size < 8) return result('collecting', days, quota.updatedAt);
    const spent = first.available - last.available;
    if (spent <= 0) return result('no-consumption', days, quota.updatedAt);
    const rate = spent / days, remaining = available / rate;
    if (remaining > 365) return result('out-of-range', days, quota.updatedAt);
    return { status: 'estimated', estimatedAt: new Date(last.at + remaining * DAY).toISOString(), averagePerDay: rate, observationDays: days, updatedAt: quota.updatedAt };
  }
}

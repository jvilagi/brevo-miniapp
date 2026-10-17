import type { AccountSnapshot, AccountsResponse, DataSection, DailyReport, ReportPeriod, SmtpMetrics } from '@brevo-miniapp/contracts';
import { smtpMetrics } from '@brevo-miniapp/contracts';
import { DataCache } from './cache.js';
import { normalizeQuota, normalizeSmtpMetrics, sevenDayPeriod } from './normalize.js';
import type { AccountConfig } from './private-config.js';
import { createHash } from 'node:crypto';
import type { PrepaidHistory } from './prepaid-history.js';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Resposta no vàlida.');
  return value as JsonObject;
}
export interface BrevoReader { get(apiKey: string, endpoint: string, query?: Record<string, string>): Promise<unknown> }
export class BrevoClient implements BrevoReader {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private fetcher: typeof fetch = fetch) {}
  async get(apiKey: string, endpoint: string, query: Record<string, string> = {}): Promise<unknown> {
    if (!['/v3/account', '/v3/smtp/statistics/aggregatedReport', '/v3/smtp/statistics/reports', '/v3/emailCampaigns', '/v3/senders'].includes(endpoint)) throw new Error('Endpoint no permès.');
    if (this.active >= 4) await new Promise<void>(resolve => this.waiting.push(resolve));
    else this.active++;
    try {
    const url = new URL(endpoint, 'https://api.brevo.com');
    url.search = new URLSearchParams(query).toString();
    const response = await this.fetcher(url, { method: 'GET', headers: { 'api-key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000), redirect: 'error' });
    if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Brevo no disponible.'); }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) throw new Error('Resposta massa gran.');
        chunks.push(value);
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } finally { await reader.cancel(); }
    } finally { const next = this.waiting.shift(); if (next) next(); else this.active--; }
  }
}

function metrics(value: unknown): SmtpMetrics {
  const result = normalizeSmtpMetrics(object(value));
  if (Object.values(result).every((item) => item === null)) throw new Error('Informe no disponible.');
  return result;
}

function dates(period: ReportPeriod): string[] {
  const day = new Date(`${period.startDate}T12:00:00Z`);
  const result: string[] = [];
  while (day.toISOString().slice(0, 10) <= period.endDate) {
    result.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}
export function dailyReport(value: unknown, period: ReportPeriod): DailyReport {
  const reports = object(value)['reports'];
  if (!Array.isArray(reports) || reports.length > 7) throw new Error('Informe diari no vàlid.');
  const validDates = dates(period);
  const items = new Map<string, SmtpMetrics>();
  for (const raw of reports) {
    const report = object(raw);
    const date = report['date'];
    if (typeof date !== 'string' || !validDates.includes(date) || items.has(date)) throw new Error('Dates no vàlides.');
    items.set(date, metrics(report));
  }
  return { days: validDates.map((date) => ({ date, currentDay: date === period.endDate,
    metrics: items.get(date) ?? normalizeSmtpMetrics(null), zeroFilled: [],
  })) };
}

export function reconcileDaily(daily: DailyReport, totals: SmtpMetrics): DailyReport {
  // Només completem dies totalment absents i mètriques additives reconciliades.
  const additive = smtpMetrics.filter((metric) => !['uniqueOpens', 'uniqueClicks'].includes(metric));
  const missing = daily.days.filter((day) => Object.values(day.metrics).every((value) => value === null));
  const observed = daily.days.filter((day) => !missing.includes(day));
  const zeroable = additive.filter((metric) => totals[metric] !== null &&
    observed.every((day) => day.metrics[metric] !== null) &&
    observed.reduce((sum, day) => sum + day.metrics[metric]!, 0) === totals[metric]);
  return { days: daily.days.map((day) => missing.includes(day) ? { ...day,
    metrics: { ...day.metrics, ...Object.fromEntries(zeroable.map((metric) => [metric, 0])) }, zeroFilled: zeroable,
  } : { ...day, metrics: { ...day.metrics }, zeroFilled: [...day.zeroFilled] }) };
}

function midnight(date: string, timezone: string): Date {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const get = (name: string) => parts.find((part) => part.type === name)!.value;
    const local = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    instant += target - local;
  }
  return new Date(instant);
}

export class AccountsService {
  private cache: DataCache;
  constructor(private accounts: AccountConfig[] | (() => AccountConfig[]), private timezone: string, private client: BrevoReader = new BrevoClient(),
    private now: () => number = Date.now, private history?: PrepaidHistory) { this.cache = new DataCache(now); }
  async snapshot(): Promise<AccountsResponse> {
    const now = new Date(this.now());
    const period = sevenDayPeriod(now, this.timezone);
    const accounts = typeof this.accounts === 'function' ? this.accounts() : this.accounts;
    return { generatedAt: now.toISOString(), accounts: await Promise.all(accounts.map((account) => this.account(account, period, now))) };
  }
  async quotas() {
    const accounts = typeof this.accounts === 'function' ? this.accounts() : this.accounts;
    const today = sevenDayPeriod(new Date(this.now()), this.timezone).endDate;
    return Promise.all(accounts.map(async account => {
      const quota = await this.quota(account, today);
      return { id: account.id, quota, ...(this.history ? { prepaidForecast: this.history.forecast(this.namespace(account), quota) } : {}) };
    }));
  }
  private namespace(account: AccountConfig) { return `${account.id}:${createHash('sha256').update(account.apiKey ?? '').digest('hex').slice(0, 16)}`; }
  private async quota(account: AccountConfig, day: string) {
    const quota = await this.cache.get(`${this.namespace(account)}:${day}:quota`, async () => {
      if (!account.apiKey) throw new Error('No disponible.');
      return normalizeQuota(object(await this.client.get(account.apiKey, '/v3/account')));
    });
    const accounts = typeof this.accounts === 'function' ? this.accounts() : this.accounts;
    // Una clau substituïda durant la lectura no pot tornar a entrar a l'històric.
    const keys = accounts.map(account => this.namespace(account));
    if (keys.includes(this.namespace(account))) await this.history?.record(this.namespace(account), quota, keys);
    return quota;
  }
  private async account(account: AccountConfig, period: ReportPeriod, now: Date): Promise<AccountSnapshot> {
    const today = { ...period, startDate: period.endDate };
    const request = (endpoint: string, query?: Record<string, string>) => {
      if (!account.apiKey) return Promise.reject(new Error('Credencial no disponible.'));
      return this.client.get(account.apiKey, endpoint, query);
    };
    const query = { startDate: period.startDate, endDate: period.endDate };
    const key = `${this.namespace(account)}:${period.startDate}:${period.endDate}`;
    const [quota, todayMetrics, totals, rawDaily, campaigns] = await Promise.all([
      this.quota(account, period.endDate),
      this.cache.get(`${key}:today`, async () => metrics(await request('/v3/smtp/statistics/aggregatedReport', { startDate: today.startDate, endDate: today.endDate }))),
      this.cache.get(`${key}:totals`, async () => metrics(await request('/v3/smtp/statistics/aggregatedReport', query))),
      this.cache.get(`${key}:daily`, async () => dailyReport(await request('/v3/smtp/statistics/reports', query), period)),
      this.cache.get(`${key}:marketing`, async () => {
        // No es desen HTML, destinataris ni estadístiques de campanya alienes al període.
        const response = object(await request('/v3/emailCampaigns', {
          startDate: midnight(period.startDate, period.timezone).toISOString(), endDate: now.toISOString(),
          limit: '1', offset: '0', excludeHtmlContent: 'true', statistics: 'globalStats',
        }));
        const count = response['count'];
        if (!Number.isSafeInteger(count) || (count as number) < 0 || !Array.isArray(response['campaigns'])) throw new Error('Campanyes no disponibles.');
        return { count: count as number };
      }),
    ]);
    let daily: DataSection<DailyReport> = rawDaily;
    if (rawDaily.data && totals.status === 'fresh' && totals.data) daily = { ...rawDaily, data: reconcileDaily(rawDaily.data, totals.data) };
    return { id: account.id, name: account.name, source: 'brevo', quota,
      ...(this.history ? { prepaidForecast: this.history.forecast(this.namespace(account), quota) } : {}),
      smtp: { source: 'smtp', period, today: { period: today, report: todayMetrics }, totals, daily },
      marketing: { source: 'marketing', period, campaigns },
    };
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountsService, BrevoClient, dailyReport, reconcileDaily, type BrevoReader } from '../src/brevo.js';
import { DataCache } from '../src/cache.js';
import { normalizeSmtpMetrics } from '../src/normalize.js';

const period = { startDate: '2026-09-25', endDate: '2026-10-01', timezone: 'Etc/GMT-2' };
const rawMetrics = { requests: 15, delivered: 12, opens: 8, uniqueOpens: 4, clicks: 3, uniqueClicks: 2 };
const accounts = [{ id: '1' as const, name: 'Compte 1', apiKey: 'synthetic-key-one' }, { id: '2' as const, name: 'Compte 2', apiKey: 'synthetic-key-two' }];

test('cache 60 segons, peticions simultànies, dades antigues i expiració', async () => {
  let now = 100_000, loads = 0;
  const cache = new DataCache(() => now);
  const load = async () => { loads++; return { requests: 15 }; };
  const results = await Promise.all([cache.get('one', load), cache.get('one', load)]);
  assert.equal(loads, 1); assert.equal(results[0]!.status, 'fresh');
  now += 59_999; await cache.get('one', load); assert.equal(loads, 1);
  now++;
  const fail = async () => { loads++; throw new Error('private-canary'); };
  const stale = await cache.get('one', fail);
  assert.equal(stale.status, 'stale'); assert.deepEqual(stale.data, { requests: 15 }); assert.equal(loads, 2);
  await cache.get('one', fail); assert.equal(loads, 2);
  now += 15 * 60_000;
  const unavailable = await cache.get('one', fail);
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.data, null); assert.equal(unavailable.updatedAt, null);
  assert(!JSON.stringify(unavailable).includes('private-canary'));
  const recovered = await cache.get('two', load); assert.equal(recovered.status, 'fresh');
});

test('dies absents només zero després de reconciliar; valors únics mai sumats', () => {
  const daily = dailyReport({ reports: [{ date: period.endDate, ...rawMetrics }] }, period);
  assert.equal(daily.days.length, 7); assert.equal(daily.days[0]!.metrics.requests, null);
  const filled = reconcileDaily(daily, normalizeSmtpMetrics({ ...rawMetrics, uniqueOpens: 20 }));
  assert.equal(filled.days[0]!.metrics.requests, 0); assert.equal(filled.days[0]!.metrics.uniqueOpens, null);
  assert.equal(filled.days[6]!.metrics.uniqueOpens, 4); assert(filled.days[6]!.currentDay);
  assert.equal(daily.days[0]!.metrics.requests, null); // No mutar la cache.
  const mismatch = reconcileDaily(daily, normalizeSmtpMetrics({ ...rawMetrics, requests: 16 }));
  assert.equal(mismatch.days[0]!.metrics.requests, null);
  for (const reports of [[{ date: '2026-09-24', ...rawMetrics }], [{ date: period.endDate, ...rawMetrics }, { date: period.endDate, ...rawMetrics }]]) {
    assert.throws(() => dailyReport({ reports }, period));
  }
});

test('comptes i fonts aïllats, intervals explícits i només dades públiques', async () => {
  let now = Date.parse('2026-10-01T10:00:00Z');
  const calls: Array<{ key: string; endpoint: string; query: Record<string, string> | undefined }> = [];
  const client: BrevoReader = { async get(key, endpoint, query) {
    calls.push({ key, endpoint, query });
    if (key === 'synthetic-key-two') throw new Error('private-canary');
    if (endpoint === '/v3/account') return { email: 'private-canary', smtp: { key: 'private-canary' }, plan: [{ type: 'payAsYouGo', creditsType: 'sendLimit', credits: 8700 }] };
    if (endpoint === '/v3/emailCampaigns') return { count: 0, campaigns: [], private: 'private-canary' };
    if (endpoint.endsWith('/reports')) return { reports: [{ date: query!.endDate, ...rawMetrics }] };
    return rawMetrics;
  } };
  const service = new AccountsService(accounts, 'Etc/GMT-2', client, () => now);
  const [snapshot] = await Promise.all([service.snapshot(), service.snapshot()]);
  assert.equal(calls.length, 10);
  assert.equal(snapshot!.accounts[0]!.quota.data!.regime, 'prepaid');
  assert.equal(snapshot!.accounts[1]!.quota.status, 'unavailable');
  assert.equal(snapshot!.accounts[1]!.smtp.totals.data, null);
  assert.deepEqual(snapshot!.accounts[0]!.smtp.period, period);
  assert.equal(snapshot!.accounts[0]!.smtp.totals.data!.uniqueOpens, 4);
  assert.equal(snapshot!.accounts[0]!.marketing.campaigns.data!.count, 0);
  assert(!JSON.stringify(snapshot).match(/private-canary|synthetic-key/));
  for (const call of calls.filter((call) => call.endpoint.includes('/statistics/'))) {
    assert(call.query!.startDate); assert(call.query!.endDate); assert.equal(call.query!['days'], undefined);
  }
  const marketing = calls.find((call) => call.endpoint === '/v3/emailCampaigns')!;
  assert.equal(marketing.query!.startDate, '2026-09-24T22:00:00.000Z');
  now = Date.parse('2026-10-01T22:00:00Z');
  const next = await service.snapshot();
  assert.equal(next.accounts[0]!.smtp.period.endDate, '2026-10-02');
  assert.equal(calls.filter((call) => call.endpoint === '/v3/account').length, 4);
});

test('una consulta SMTP fallida no anul·la quota, avui ni màrqueting', async () => {
  const client: BrevoReader = { async get(_key, endpoint, query) {
    if (endpoint === '/v3/account') return { plan: [{ type: 'free', creditsType: 'sendLimit', credits: 285 }] };
    if (endpoint === '/v3/emailCampaigns') return { campaigns: [], count: 0 };
    if (endpoint.endsWith('/reports') || query?.startDate !== query?.endDate) throw new Error();
    return rawMetrics;
  } };
  const response = await new AccountsService(accounts, 'Etc/GMT-2', client, () => Date.parse('2026-10-01T10:00:00Z')).snapshot();
  const account = response.accounts[0]!;
  assert.equal(account.quota.data!.available, 285); assert.equal(account.smtp.today.report.status, 'fresh');
  assert.equal(account.smtp.totals.status, 'unavailable'); assert.equal(account.smtp.daily.status, 'unavailable');
  assert.equal(account.marketing.campaigns.status, 'fresh');
});

test('sense clau no es consulta Brevo ni es creen zeros', async () => {
  const client: BrevoReader = { get() { throw new Error('No s’hauria de consultar.'); } };
  const response = await new AccountsService([{ ...accounts[0]!, apiKey: null }], 'Etc/GMT-2', client).snapshot();
  assert.equal(response.accounts[0]!.quota.data, null);
  assert.equal(response.accounts[0]!.smtp.daily.data, null);
});

test('client restringit a GET, origen Brevo i capçalera backend; errors sense resposta privada', async () => {
  let calls = 0;
  const fetcher = (async (url: URL, options: RequestInit) => {
    calls++;
    assert.equal(url.origin, 'https://api.brevo.com'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    assert.equal((options.headers as Record<string, string>)['api-key'], 'synthetic-key');
    assert(url.searchParams.has('startDate'));
    return new Response(JSON.stringify({ requests: 15 }), { status: 200 });
  }) as typeof fetch;
  const client = new BrevoClient(fetcher);
  assert.deepEqual(await client.get('synthetic-key', '/v3/smtp/statistics/reports', { startDate: period.startDate }), { requests: 15 });
  await assert.rejects(client.get('synthetic-key', 'https://evil.test')); assert.equal(calls, 1);
  const failing = new BrevoClient((async () => new Response('private-canary', { status: 401 })) as typeof fetch);
  await assert.rejects(failing.get('synthetic-key', '/v3/account'), (error: Error) => !error.message.includes('private-canary'));
  const oversized = new BrevoClient((async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))) as typeof fetch);
  await assert.rejects(oversized.get('synthetic-key', '/v3/account'));
});

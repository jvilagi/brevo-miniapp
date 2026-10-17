import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeBalance, type DataSection, type Quota } from '@brevo-miniapp/contracts';
import { PrepaidHistory } from '../src/prepaid-history.js';
import { AccountsService } from '../src/brevo.js';
import type { PrivateConfig } from '../src/private-config.js';
const DAY = 86400000, key = '1:1234567890abcdef';
const quota = (at: number, available = 1200): DataSection<Quota> => ({ status: 'fresh', updatedAt: new Date(at).toISOString(), error: null,
  data: { regime: 'subscription', available: 300, dailyLimit: null, prepaidAvailable: available } });
async function setup(t: { after: (fn: () => Promise<unknown>) => void }) {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-prepaid-history-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const config: PrivateConfig = { production: false, origin: '', timezone: 'Etc/GMT-2', accounts: [], workspaceFile: join(directory, 'workspace.sealed.json'),
    auth: { passwordHash: 'not-used-in-this-test', sessionSecret: 's'.repeat(43) } };
  let now = Date.parse('2026-09-01T09:00:00Z');
  const history = (await PrepaidHistory.open(config, () => now))!;
  const record = async (balance: number, advance = 0) => { now += advance; await history.record(key, quota(now, balance), [key]); return history.forecast(key, quota(now, balance)); };
  return { config, history, directory, record, now: () => now, advance: (ms: number) => { now += ms; } };
}
test('saldo actiu: Free amb prepagament no usa els 300, tampoc amb reserva zero o absent', () => {
  const raw = quota(Date.now()).data!;
  assert.deepEqual(activeBalance(raw, 'free'), { kind: 'prepaid', available: 1200, freePrepaid: true });
  assert.equal(activeBalance(raw).available, 300);
  assert.equal(activeBalance({ regime: 'subscription', available: 300, dailyLimit: null, prepaidAvailable: 0 }, 'free').available, 0);
  assert.equal(activeBalance({ regime: 'subscription', available: 300, dailyLimit: null, prepaidAvailable: null }, 'free').available, null);
  assert.equal(activeBalance({ regime: 'free', available: 249, dailyLimit: 300 }, 'free').available, 249);
});
test('previsió: xifrat, persistència i almenys set dies de baixades reals de saldo', async t => {
  const c = await setup(t); let forecast = await c.record(1200);
  assert.equal(forecast.status, 'collecting');
  for (let day = 1; day <= 7; day++) forecast = await c.record(1200 - 100 * day, DAY);
  assert.equal(forecast.status, 'estimated'); assert.equal(forecast.averagePerDay, 100); assert.equal(forecast.observationDays, 7);
  assert.equal(Date.parse(forecast.estimatedAt!), c.now() + 5 * DAY);
  const file = join(c.directory, 'prepaid-history.sealed.json'), bytes = await readFile(file, 'utf8');
  assert(!bytes.includes(key)); assert(!bytes.includes('available'));
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const restarted = (await PrepaidHistory.open(c.config, c.now))!;
  assert.deepEqual(restarted.forecast(key, quota(c.now(), 500)), forecast);
});
test('previsió: cache, dada antiga, zero i saldo desconegut no inventen consum', async t => {
  const c = await setup(t); await c.record(1200);
  const file = join(c.directory, 'prepaid-history.sealed.json'), before = await readFile(file, 'utf8');
  await c.history.record(key, quota(c.now()), [key]); assert.equal(await readFile(file, 'utf8'), before);
  c.advance(DAY);
  const stale: DataSection<Quota> = { ...quota(c.now()), status: 'stale' };
  await c.history.record(key, stale, [key]); assert.equal(await readFile(file, 'utf8'), before);
  assert.equal(c.history.forecast(key, stale).status, 'unavailable');
  assert.equal(c.history.forecast(key, { ...quota(c.now()), updatedAt: 'invalid' }).status, 'unavailable');
  assert.equal(c.history.forecast(key, quota(c.now() + DAY)).status, 'unavailable');
  assert.equal((await c.record(0)).status, 'exhausted');
  const missing = { ...quota(c.now()), data: { regime: 'unknown' as const, available: null, dailyLimit: null } };
  assert.equal(c.history.forecast(key, missing).status, 'not-applicable');
});
test('previsió: recàrrega, interrupció i substitució de clau reinicien la mostra', async t => {
  const c = await setup(t); await c.record(1200);
  for (let day = 1; day <= 7; day++) await c.record(1200 - 100 * day, DAY);
  assert.equal((await c.record(1600, 60000)).status, 'collecting');
  assert.equal((await c.record(1500, 2 * DAY)).observationDays, 0);
  const newKey = '1:abcdef1234567890'; c.advance(60000);
  await c.history.record(newKey, quota(c.now(), 1400), [newKey]);
  assert.equal(c.history.forecast(newKey, quota(c.now(), 1400)).status, 'collecting');
  assert.equal(c.history.forecast(key, quota(c.now(), 1400)).status, 'collecting');
});
test('previsió: sense consum no hi ha data i les lectures intradia són limitades', async t => {
  const c = await setup(t); await c.record(1200);
  for (let day = 1; day <= 7; day++) {
    await c.record(1200, DAY - 60000);
    for (let read = 0; read < 10; read++) await c.record(1200, 6000);
  }
  const forecast = c.history.forecast(key, quota(c.now()));
  assert.equal(forecast.status, 'no-consumption'); assert.equal(forecast.estimatedAt, null);
  assert((await stat(join(c.directory, 'prepaid-history.sealed.json'))).size < 3000);
});
test('previsió: errors del fitxer privat no bloquegen l’app ni sobreescriuen l’històric', async t => {
  const c = await setup(t); await c.record(1200); const file = join(c.directory, 'prepaid-history.sealed.json');
  const bytes = await readFile(file, 'utf8');
  await chmod(c.directory, 0o755); assert.equal((await c.record(1100, DAY)).status, 'unavailable'); await chmod(c.directory, 0o700);
  assert.equal(await readFile(file, 'utf8'), bytes);
  await writeFile(file, '{"corrupted":true}');
  const broken = (await PrepaidHistory.open(c.config, c.now))!;
  await broken.record(key, quota(c.now(), 1100), [key]);
  assert.equal(broken.forecast(key, quota(c.now(), 1100)).status, 'unavailable');
  assert.equal(await readFile(file, 'utf8'), '{"corrupted":true}');
});
test('previsió: comptes concurrents i integració de quotes, sense lectures Brevo addicionals', async t => {
  const c = await setup(t); let calls = 0;
  const service = new AccountsService([{ id: '1', name: 'Prova', apiKey: 'synthetic-history-key-only' }], 'Etc/GMT-2', {
    async get() { calls++; return { plan: [{ type: 'payAsYouGo', creditsType: 'sendLimit', credits: 1200 }] }; },
  }, c.now, c.history);
  const [first, second] = await Promise.all([service.quotas(), service.quotas()]);
  assert.equal(calls, 1); assert.equal(first[0]!.prepaidForecast!.status, 'collecting'); assert.deepEqual(second, first);
  assert(!JSON.stringify(first).includes('synthetic-history-key-only'));
  const keys = Array.from({ length: 25 }, (_, n) => `${n}:1234567890abcdef`);
  await Promise.all(keys.map(k => c.history.record(k, quota(c.now()), keys)));
  for (const k of keys) assert.equal(c.history.forecast(k, quota(c.now())).status, 'collecting');
});

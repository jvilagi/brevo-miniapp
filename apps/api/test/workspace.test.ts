import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Workspace, accountInput, alertInput, pushSubscription, SettingsFailure } from '../src/workspace.js';
import { hashPassword } from '../src/password.js';
import type { PrivateConfig } from '../src/private-config.js';
import { buildApp } from '../src/app.js';
import { AccountsService, BrevoClient, type BrevoReader } from '../src/brevo.js';
import { AlertMonitor, BrevoAlertSender, SendRejected } from '../src/email-alerts.js';
import { generatePushKeys, PushExpired } from '../src/push-alerts.js';
import { randomBytes } from 'node:crypto';

const password = 'synthetic-settings-password';
const hash = await hashPassword(password);
const origin = 'https://miniapp.example.test';
const headers = { origin, 'x-app-request': '1' };
const metadata = { name: 'Nou compte', appearance: { icon: 'work' as const, color: 'blue' as const },
  reference: { kind: 'subscription' as const, allowance: 5000, renewalDay: 12 }, lowBalance: 100, lowPercent: 10 };
const reader: BrevoReader = { async get(_key, endpoint) { return endpoint === '/v3/senders' ? { senders: [{ id: 8, active: true, email: 'sender@example.test', name: 'Emissor' }] } : { plan: [{ type: 'free', creditsType: 'sendLimit', credits: 250 }] }; } };
async function setup(t: { after: (fn: () => Promise<unknown>) => void }, enabled = false) {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-workspace-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const config: PrivateConfig = { auth: { passwordHash: hash, sessionSecret: 's'.repeat(43) }, accounts: [
    { id: '1', name: 'Compte 1', apiKey: 'synthetic-first-credential-only' }, { id: '2', name: 'Compte 2', apiKey: 'synthetic-second-credential-only' },
  ], production: true, origin, timezone: 'Etc/GMT-2', workspaceFile: join(directory, 'workspace.sealed.json'), emailDeliveryEnabled: enabled };
  const workspace = await Workspace.open(config);
  return { directory, config, workspace };
}
async function instance(t: { after: (fn: () => Promise<unknown>) => void }) {
  const context = await setup(t);
  let validations = 0;
  const service = new AccountsService(() => context.workspace.accounts(), 'Etc/GMT-2', reader);
  const app = await buildApp({ privateConfig: context.config, workspace: context.workspace, accountsService: service,
    brevoClient: { async get(key, endpoint, query) { validations++; return reader.get(key, endpoint, query); } },
    alertSender: { async send() { throw new Error('No s’ha d’enviar.'); } } });
  t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  const post = (url: string, payload: unknown, extra = {}) => app.inject({ method: 'POST', url, headers: { ...headers, cookie, ...extra }, payload: JSON.stringify(payload) });
  // Les peticions post de proves indiquen explícitament el tipus de JSON.
  const send = (url: string, payload: unknown, extra = {}) => post(url, payload, { 'content-type': 'application/json', ...extra });
  return { ...context, app, cookie, send, validations: () => validations };
}

test('workspace: migració de lectura, xifrat, reinici i cap secret a la projecció pública', async t => {
  const { workspace, config, directory } = await setup(t);
  const withoutKeys = await Workspace.open({ ...config, workspaceFile: join(directory, 'empty.sealed.json'), accounts: [{ id: '1', name: 'Compte 1', apiKey: null }] });
  await withoutKeys.update(0, '1', metadata, null, async () => {});
  assert.equal(withoutKeys.settings().accounts[0]!.connected, false);
  await assert.rejects(stat(config.workspaceFile!), { code: 'ENOENT' });
  assert.deepEqual(workspace.settings().accounts.map(a => a.id), ['1', '2']);
  await workspace.add(0, metadata, 'synthetic-added-credential-only', async () => {});
  const bytes = await readFile(config.workspaceFile!, 'utf8');
  for (const secret of ['synthetic-first-credential-only', 'synthetic-added-credential-only', 'Nou compte', password]) assert(!bytes.includes(secret));
  assert.equal((await stat(config.workspaceFile!)).mode & 0o777, 0o600);
  assert(!JSON.stringify(workspace.settings()).includes('credential'));
  assert(!JSON.stringify(workspace.settings()).includes('apiKey'));
  const restarted = await Workspace.open(config);
  assert.equal(restarted.accounts().length, 3); assert.equal(restarted.accounts()[2]!.apiKey, 'synthetic-added-credential-only');
  assert.equal(restarted.settings().accounts[2]!.reference.allowance, 5000);
  await assert.rejects(Workspace.open({ ...config, auth: { ...config.auth!, sessionSecret: 'z'.repeat(43) } }));
  await chmod(config.workspaceFile!, 0o644); await assert.rejects(Workspace.open(config)); await chmod(config.workspaceFile!, 0o600);
  const corrupted = JSON.parse(bytes); corrupted.tag = '0'.repeat(32); await writeFile(config.workspaceFile!, JSON.stringify(corrupted));
  await assert.rejects(Workspace.open(config)); assert((await stat(directory)).isDirectory());
});
test('workspace: validació de camps, percentatges, claus duplicades i revisió concurrent', async t => {
  const { workspace } = await setup(t);
  for (const value of [{ ...metadata, name: '  ' }, { ...metadata, appearance: { icon: 'external-url', color: 'blue' } },
    { ...metadata, reference: { ...metadata.reference, allowance: null } }, { ...metadata, lowBalance: -1 }, { ...metadata, extra: true }]) assert.throws(() => accountInput(value));
  assert.throws(() => alertInput({ enabled: true, recipient: 'invalid', senderAccountId: '1', senderId: 8, repeatMinutes: 1, connectionErrors: true }));
  await assert.rejects(workspace.add(0, metadata, workspace.accounts()[0]!.apiKey!, async () => {}));
  await workspace.update(0, '1', metadata, null, async () => {});
  await assert.rejects(workspace.remove(0, '1'), error => error instanceof SettingsFailure && error.status === 409);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(r => { release = r; }), started = new Promise<void>(r => { entered = r; });
  const saving = workspace.add(1, metadata, 'synthetic-new-private-key-only', async () => { entered(); await gate; });
  await started; await assert.rejects(workspace.remove(1, '2')); release(); await saving;
});
test('workspace API: sessió, origen i reautenticació abans de validar una clau', async t => {
  const { app, send, validations } = await instance(t);
  assert.equal((await app.inject('/api/workspace')).statusCode, 401);
  const body = { revision: 0, account: metadata, credential: 'synthetic-new-private-key-only', currentPassword: 'wrong' };
  assert.equal((await send('/api/workspace/accounts', body)).statusCode, 400); assert.equal(validations(), 0);
  assert.equal((await send('/api/workspace/accounts', { ...body, currentPassword: password }, { origin: 'https://evil.test' })).statusCode, 403);
  const response = await send('/api/workspace/accounts', { ...body, currentPassword: password });
  assert.equal(response.statusCode, 200); assert.equal(response.json().accounts.length, 3); assert.equal(validations(), 1);
  assert.equal(response.headers['cache-control'], 'no-store'); assert(!response.body.includes('synthetic-new-private-key-only'));
  assert.equal((await send('/api/workspace/accounts', { ...body, revision: 1, currentPassword: password, extra: true })).statusCode, 400);
});
test('workspace API: ordre, metadades, zero comptes i desconnexió de l’emissor', async t => {
  const { app, send, cookie } = await instance(t);
  assert.equal((await send('/api/workspace/order', { revision: 0, ids: ['2', '1'] })).statusCode, 200);
  assert.equal((await send('/api/workspace/accounts/1', { revision: 1, account: metadata, credential: '', currentPassword: '' })).statusCode, 200);
  const snapshot = await app.inject({ url: '/api/accounts', headers: { cookie } });
  assert.equal(snapshot.json().accounts[1].name, metadata.name); assert.equal(snapshot.json().accounts[1].appearance.color, 'blue');
  const alerts = { enabled: true, recipient: 'recipient@example.test', senderAccountId: '2', senderId: 8, repeatMinutes: 1440, connectionErrors: true };
  assert.equal((await send('/api/workspace/alerts', { revision: 2, alerts, currentPassword: password })).statusCode, 200);
  const removed = await send('/api/workspace/accounts/2/disconnect', { revision: 3, currentPassword: password });
  assert.equal(removed.statusCode, 200); assert.equal(removed.json().alerts.enabled, false);
  assert.equal((await send('/api/workspace/accounts/1/disconnect', { revision: 4, currentPassword: password })).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/accounts', headers: { cookie } })).json().accounts, []);
});
test('workspace API: remitent validat, gate d’enviament i errors sense secrets', async t => {
  const { app, send, cookie } = await instance(t);
  const list = await app.inject({ url: '/api/workspace/accounts/1/senders', headers: { cookie } }); assert.equal(list.statusCode, 200); assert.equal(list.json().senders[0].id, 8);
  const alerts = { enabled: true, recipient: 'recipient@example.test', senderAccountId: '1', senderId: 99, repeatMinutes: 1440, connectionErrors: true };
  assert.equal((await send('/api/workspace/alerts', { revision: 0, alerts, currentPassword: password })).statusCode, 422);
  assert.equal((await send('/api/workspace/alerts', { revision: 0, alerts: { ...alerts, senderId: 8 }, currentPassword: password })).statusCode, 200);
  assert.equal((await send('/api/workspace/alerts/test', { revision: 1, currentPassword: password })).statusCode, 503);
});
const pushFixture = () => ({ endpoint: 'https://web.push.apple.com/synthetic-endpoint', keys: { auth: randomBytes(16).toString('base64url'), p256dh: generatePushKeys().publicKey } });
test('push: permet només serveis coneguts, claus vàlides i endpoints HTTPS sense credencials', () => {
  const good = pushFixture(); assert.equal(pushSubscription(good).endpoint, good.endpoint);
  for (const endpoint of ['http://web.push.apple.com/x', 'https://127.0.0.1/x', 'https://web.push.apple.com.evil.test/x', 'https://user:pass@web.push.apple.com/x', 'https://web.push.apple.com:8443/x']) assert.throws(() => pushSubscription({ ...good, endpoint }));
  assert.throws(() => pushSubscription({ ...good, keys: { ...good.keys, auth: 'bad' } }));
});
test('push API: VAPID privada no retornada i registre/eliminació del dispositiu', async t => {
  const { send, workspace, config } = await instance(t);
  const key = await send('/api/workspace/push/key', {}); assert.equal(key.statusCode, 200); assert.equal(Object.keys(key.json()).length, 1);
  const fixture = pushFixture();
  const subscription = await send('/api/workspace/push/subscribe', { subscription: fixture, label: 'Telèfon de prova' });
  assert.equal(subscription.statusCode, 200); assert.equal(subscription.json().pushDevices.length, 1);
  assert(!subscription.body.includes(fixture.endpoint)); assert(!subscription.body.includes(workspace.pushData().keys!.privateKey));
  const restarted = await Workspace.open(config); assert.equal(restarted.pushData().devices.length, 1);
  assert.equal((await send('/api/workspace/push/unsubscribe', { endpoint: fixture.endpoint })).json().pushEnabled, false);
});
const quota = (available: number) => ({ id: '1', quota: { status: 'fresh' as const, data: { regime: 'free' as const, available, dailyLimit: 300 as const }, updatedAt: new Date().toISOString(), error: null } });
async function configured(t: { after: (fn: () => Promise<unknown>) => void }, enabled = true) {
  const context = await setup(t, enabled);
  await context.workspace.edit(0, draft => {
    draft.accounts[0]!.lowBalance = 20;
    draft.alerts = { enabled: true, recipient: 'recipient@example.test', senderAccountId: '2', senderId: 8, repeatMinutes: 1440, connectionErrors: true };
  }); return context;
}
test('avisos: compte emissor triat, deduplicació durable i saldo no modificat', async t => {
  const { workspace, config } = await configured(t); let now = Date.parse('2026-10-17T09:00:00Z'), calls = 0;
  const row = quota(10), service = new AlertMonitor(workspace, async () => [row], { async send(key, id, recipient) {
    calls++; assert.equal(key, 'synthetic-second-credential-only'); assert.equal(id, 8); assert.equal(recipient, 'recipient@example.test');
  } }, () => now);
  await service.tick(); assert.equal(calls, 1); assert.equal(row.quota.data.available, 10);
  assert.equal(workspace.settings().deliveries[0]!.accountId, '2'); assert.equal(workspace.settings().deliveries[0]!.status, 'accepted');
  now += 300000; await service.tick(); assert.equal(calls, 1);
  const restarted = new AlertMonitor(await Workspace.open(config), async () => [row], { async send() { calls++; } }, () => now);
  await restarted.tick(); assert.equal(calls, 1);
  now += 86400000; await restarted.tick(); assert.equal(calls, 2);
});
test('avisos: dades antigues no creen saldo zero ni rearmen un avís de saldo', async t => {
  const { workspace } = await configured(t); let now = Date.parse('2026-10-17T09:00:00Z'), calls = 0, fresh = true;
  const service = new AlertMonitor(workspace, async () => fresh ? [quota(10)] : [{ id: '1', quota: { ...quota(10).quota, status: 'stale' } }], { async send() { calls++; } }, () => now);
  await service.tick(); assert.equal(calls, 1);
  fresh = false; now += 300000; await service.tick(); assert.equal(calls, 1);
  now += 300000; fresh = true; await service.tick(); assert.equal(calls, 1);
});
test('avisos: subscripció esgotada explicita els crèdits de reserva, sense sumar-los', async t => {
  const { workspace } = await configured(t); let message = '';
  await new AlertMonitor(workspace, async () => [{ id: '1', quota: { status: 'fresh', updatedAt: new Date().toISOString(), error: null,
    data: { regime: 'subscription', available: 0, dailyLimit: null, prepaidAvailable: 4800 } } }],
  { async send(_key, _sender, _recipient, _subject, text) { message = text; } }).tick();
  assert.match(message, /subscripció segons Brevo 0/); assert.match(message, /prepagament 4800/);
});
test('avisos: errors d’enviament i timeouts no es reintenten immediatament', async t => {
  const { workspace } = await configured(t); let calls = 0;
  const service = new AlertMonitor(workspace, async () => [quota(10)], { async send() { calls++; throw new Error('private-response-canary'); } });
  await service.tick(); await service.tick(); assert.equal(calls, 1); assert.equal(workspace.settings().deliveries[0]!.status, 'uncertain');
  assert(!JSON.stringify(workspace.settings()).includes('private-response-canary'));
});
test('avisos: gate desactivat, error de persistència i pressupost diari impedeixen enviar', async t => {
  const disabled = await configured(t, false); let calls = 0;
  const sender = { async send() { calls++; } };
  await new AlertMonitor(disabled.workspace, async () => [quota(10)], sender).tick(); assert.equal(calls, 0);
  const enabled = await configured(t);
  await chmod(enabled.directory, 0o755);
  await assert.rejects(new AlertMonitor(enabled.workspace, async () => [quota(10)], sender).tick()); assert.equal(calls, 0); await chmod(enabled.directory, 0o700);
  await enabled.workspace.edit(null, draft => { draft.emailBudget = { day: new Date().toISOString().slice(0, 10), attempts: 20 }; });
  await assert.rejects(new AlertMonitor(enabled.workspace, async () => [quota(10)], sender).tick()); assert.equal(calls, 0);
});
test('avisos push independents del correu; subscripcions caducades netejades', async t => {
  const { workspace } = await configured(t); let pushes = 0, emails = 0;
  await workspace.edit(null, draft => {
    draft.alerts.enabled = false; draft.push.keys = generatePushKeys(); draft.push.enabled = true;
    draft.push.devices.push({ ...pushFixture(), id: 'device', label: 'Prova', createdAt: new Date().toISOString() });
  });
  await new AlertMonitor(workspace, async () => [quota(10)], { async send() { emails++; } }, Date.now,
    { async send() { pushes++; throw new PushExpired(); } }).tick();
  assert.equal(pushes, 1); assert.equal(emails, 0); assert.equal(workspace.settings().pushEnabled, false);
  assert.equal(workspace.settings().deliveries[0]!.channel, 'push'); assert.equal(workspace.settings().deliveries[0]!.accountId, null);
});
test('client d’avisos: només POST fix, emissor correcte, sense adjunts i 201 requerit', async () => {
  let body: Record<string, unknown> | undefined;
  const sender = new BrevoAlertSender(async (url, options) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); assert.equal(options?.method, 'POST');
    body = JSON.parse(String(options?.body)); return new Response('{}', { status: 201 });
  });
  await sender.send('synthetic-key', 8, 'recipient@example.test', 'Prova', '<private>');
  assert.deepEqual(body?.sender, { id: 8 }); assert(!('attachment' in body!)); assert(String(body?.htmlContent).includes('&lt;private&gt;'));
  await assert.rejects(new BrevoAlertSender(async () => new Response('{}', { status: 400 })).send('synthetic-key', 8, 'recipient@example.test', 'Prova', 'test'), SendRejected);
});
test('client Brevo: màxim quatre lectures concurrents', async () => {
  let active = 0, max = 0;
  const client = new BrevoClient(async () => { active++; max = Math.max(max, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return new Response('{"plan":[]}'); });
  await Promise.all(Array.from({ length: 20 }, () => client.get('synthetic-key', '/v3/account'))); assert(max <= 4);
});
test('workspace API: logout durant la validació impedeix desar la clau', async t => {
  const { workspace, config } = await setup(t);
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(r => { release = r; }), started = new Promise<void>(r => { entered = r; });
  const app = await buildApp({ privateConfig: config, workspace, brevoClient: { async get() { entered(); await gate; return { plan: [] }; } } });
  t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });
  const cookie = String(login.headers['set-cookie']).split(';')[0]!;
  const pending = app.inject({ method: 'POST', url: '/api/workspace/accounts', headers: { ...headers, cookie }, payload: {
    revision: 0, account: metadata, credential: 'synthetic-new-private-key-only', currentPassword: password,
  } });
  const response = Promise.resolve(pending); await started;
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { ...headers, cookie }, payload: {} })).statusCode, 200);
  release(); assert.equal((await response).statusCode, 401); assert.equal(workspace.settings().revision, 0);
});
test('avisos: pressupost persistent independent de l’historial i push encara actives', async t => {
  const { workspace, config } = await configured(t); let emails = 0, pushes = 0;
  await workspace.edit(null, draft => {
    draft.emailBudget = { day: new Date().toISOString().slice(0, 10), attempts: 20 };
    draft.deliveries = []; // Netejar o retallar l'historial no ha de restablir el pressupost.
    draft.push.keys = generatePushKeys(); draft.push.enabled = true;
    draft.push.devices.push({ ...pushFixture(), id: 'device', label: 'Prova', createdAt: new Date().toISOString() });
  });
  const restarted = await Workspace.open(config);
  await new AlertMonitor(restarted, async () => [quota(10)], { async send() { emails++; } }, Date.now, { async send() { pushes++; } }).tick();
  assert.equal(emails, 0); assert.equal(pushes, 1); assert.equal(restarted.settings().deliveries[0]!.channel, 'push');
});
test('avisos: reserva pendent després d’una interrupció no duplica l’enviament', async t => {
  const { workspace, config } = await configured(t); const now = Date.now(); let emails = 0;
  await workspace.edit(null, draft => {
    draft.incidents['1:balance'] = { active: true, firstProblem: now, lastAttempt: now };
    draft.deliveries.push({ id: 'pending', accountId: '2', channel: 'email', kind: 'alert', at: new Date(now).toISOString(), status: 'pending' });
  });
  await new AlertMonitor(await Workspace.open(config), async () => [quota(10)], { async send() { emails++; } }, () => now + 300000).tick();
  assert.equal(emails, 0);
});
test('avisos: el rebuig del correu no atura les notificacions push', async t => {
  const { workspace } = await configured(t); let pushes = 0;
  await workspace.edit(null, draft => {
    draft.push.keys = generatePushKeys(); draft.push.enabled = true;
    draft.push.devices.push({ ...pushFixture(), id: 'device', label: 'Prova', createdAt: new Date().toISOString() });
  });
  await new AlertMonitor(workspace, async () => [quota(10)], { async send() { throw new SendRejected(); } }, Date.now, { async send() { pushes++; } }).tick();
  assert.equal(pushes, 1);
  assert.deepEqual(workspace.settings().deliveries.map(row => row.status), ['rejected', 'accepted']);
});

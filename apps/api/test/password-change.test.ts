import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/password.js';
import { readStoredPassword, savePassword } from '../src/password-store.js';
import { loadPrivateConfig, type PrivateConfig } from '../src/private-config.js';

const currentPassword = 'synthetic-current-password';
const newPassword = 'synthetic-new-password-only';
const hash = await hashPassword(currentPassword);
const origin = 'https://miniapp.example.test';
const headers = { origin, 'x-app-request': '1' };
const config: PrivateConfig = { auth: { passwordHash: hash, sessionSecret: 's'.repeat(43) }, origin,
  production: true, timezone: 'Etc/GMT-2', accounts: [] };
const payload = { currentPassword, newPassword, confirmation: newPassword };
const cookieOf = (response: { headers: Record<string, unknown> }) => String(response.headers['set-cookie']).split(';')[0]!;
const login = (app: Awaited<ReturnType<typeof buildApp>>, password = currentPassword) => app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });

test('canvi només amb sessió, origen vàlid i contrasenya actual; dades invàlides no es desen', async (t) => {
  let writes = 0;
  const app = await buildApp({ privateConfig: config, passwordWriter: async () => { writes++; } }); t.after(() => app.close());
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/password', headers, payload })).statusCode, 401);
  const cookie = cookieOf(await login(app));
  for (const bad of [{}, { origin }, { ...headers, origin: 'https://evil.test' }, { ...headers, 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...bad, cookie }, payload })).statusCode, 403);
  }
  // Cada app evita que el límit d'intents interfereixi amb les comprovacions de schema.
  for (const invalid of [{ ...payload, newPassword: 'short' }, { ...payload, currentPassword: 'x'.repeat(257) },
    { ...payload, confirmation: 'different-confirmation' }, { currentPassword, newPassword: currentPassword, confirmation: currentPassword }]) {
    const instance = await buildApp({ privateConfig: config, passwordWriter: async () => { writes++; } });
    const session = cookieOf(await login(instance));
    assert.equal((await instance.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie: session }, payload: invalid })).statusCode, 400);
    await instance.close();
  }
  const check = await buildApp({ privateConfig: config, passwordWriter: async () => { writes++; } }); t.after(() => check.close());
  const session = cookieOf(await login(check));
  const rejected = await check.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie: session }, payload: { ...payload, currentPassword: 'wrong' } });
  assert.equal(rejected.statusCode, 400); assert.deepEqual(rejected.json(), { error: 'CURRENT_PASSWORD_INCORRECT' });
  assert.equal((await check.inject({ url: '/api/auth/session', headers: { cookie: session } })).json().authenticated, true);
  assert.equal(writes, 0); assert(!rejected.body.includes(currentPassword));
});

test('canvi persistent, hash privat, totes les sessions revocades i contrasenya nova després de reiniciar', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-password-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const keys = join(directory, 'accounts.env'), auth = join(directory, 'auth.env');
  await writeFile(keys, '', { mode: 0o600 });
  const bootstrap = `APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${'s'.repeat(43)}\n`;
  await writeFile(auth, bootstrap, { mode: 0o600 });
  const env = { BREVO_SECRETS_FILE: keys, AUTH_SECRETS_FILE: auth, PUBLIC_ORIGIN: origin, NODE_ENV: 'production' };
  const initial = await loadPrivateConfig(env);
  const app = await buildApp({ privateConfig: initial }); t.after(() => app.close());
  const first = cookieOf(await login(app)), second = cookieOf(await login(app));
  const changed = await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie: first }, payload });
  assert.equal(changed.statusCode, 200); assert.deepEqual(changed.json(), { authenticated: false, configured: true });
  assert(String(changed.headers['set-cookie']).includes('Expires=Thu, 01 Jan 1970'));
  for (const cookie of [first, second]) assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, false);
  assert.equal((await login(app)).statusCode, 401); assert.equal((await login(app, newPassword)).statusCode, 200);
  const content = await readFile(initial.passwordFile!, 'utf8');
  assert(!content.includes(newPassword)); assert(!content.includes('sessionSecret'));
  assert.equal((await lstat(initial.passwordFile!)).mode & 0o777, 0o600);
  assert.equal((await readFile(auth, 'utf8')), bootstrap); // No es toquen secrets inicials.
  const restarted = await buildApp({ privateConfig: await loadPrivateConfig(env) }); t.after(() => restarted.close());
  assert.equal((await login(restarted)).statusCode, 401); assert.equal((await login(restarted, newPassword)).statusCode, 200);
});

test('fallada d’escriptura no canvia contrasenya ni revoca sessions; resposta sense detalls privats', async (t) => {
  const app = await buildApp({ privateConfig: config, passwordWriter: async () => { throw new Error('private-path-canary'); } }); t.after(() => app.close());
  const cookie = cookieOf(await login(app));
  const failed = await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie }, payload });
  assert.equal(failed.statusCode, 500); assert.deepEqual(failed.json(), { error: 'INTERNAL_ERROR' });
  assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, true);
  assert.equal((await login(app)).statusCode, 200); assert(!failed.body.includes('private-path-canary'));
});

test('canvis concurrents i login durant la substitució queden bloquejats', async (t) => {
  let release!: () => void, entered!: () => void, writes = 0;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const app = await buildApp({ privateConfig: config, passwordWriter: async () => { writes++; entered(); await waiting; } }); t.after(() => app.close());
  const cookie = cookieOf(await login(app));
  const first = app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie }, payload });
  await started;
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie }, payload })).statusCode, 429);
  assert.equal((await login(app)).statusCode, 429);
  release(); assert.equal((await first).statusCode, 200); assert.equal(writes, 1);
});

test('canvi de contrasenya limitat a cinc intents i indisponible sense persistència', async (t) => {
  const unavailable = await buildApp({ privateConfig: config }); t.after(() => unavailable.close());
  const cookie = cookieOf(await login(unavailable));
  assert.equal((await unavailable.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie }, payload })).statusCode, 503);
  const app = await buildApp({ privateConfig: config, passwordWriter: async () => { throw new Error('No ha de desar.'); } }); t.after(() => app.close());
  const session = cookieOf(await login(app));
  for (let i = 0; i < 5; i++) assert.equal((await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie: session }, payload: { ...payload, currentPassword: 'wrong' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/password', headers: { ...headers, cookie: session }, payload })).statusCode, 429);
});

test('magatzem rebutja checkout, enllaços, permisos oberts i contingut invàlid; falla tancat en reiniciar', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-store-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'password.json');
  assert.equal(await readStoredPassword(file), null); await savePassword(file, hash);
  assert(await verifyPassword(currentPassword, (await readStoredPassword(file))!));
  assert.equal((await readStoredPassword(file)), hash);
  await chmod(file, 0o644); await assert.rejects(readStoredPassword(file)); await chmod(file, 0o600);
  const link = join(directory, 'link.json'); await symlink(file, link);
  await assert.rejects(readStoredPassword(link)); await assert.rejects(savePassword(link, hash));
  await chmod(directory, 0o755); await assert.rejects(savePassword(file, hash)); await chmod(directory, 0o700);
  await assert.rejects(savePassword(join(process.cwd(), 'private-password-test', 'password.json'), hash));
  await assert.rejects(readStoredPassword('relative.json'));
  await writeFile(file, 'invalid-private-canary'); await assert.rejects(readStoredPassword(file));
  const keys = join(directory, 'accounts.env'), auth = join(directory, 'auth.env');
  await writeFile(keys, '', { mode: 0o600 }); await writeFile(auth, `APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${'s'.repeat(43)}\n`, { mode: 0o600 });
  await assert.rejects(loadPrivateConfig({ BREVO_SECRETS_FILE: keys, AUTH_SECRETS_FILE: auth, AUTH_PASSWORD_FILE: file }));
});

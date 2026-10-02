import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { hashPassword, validPasswordHash, verifyPassword } from '../src/password.js';
import type { PrivateConfig } from '../src/private-config.js';

const password = 'synthetic-test-password-only';
const hash = await hashPassword(password);
const origin = 'https://brevo.example.test';
const headers = { origin, 'x-app-request': '1' };
const config: PrivateConfig = { production: true, auth: { passwordHash: hash, sessionSecret: 'a'.repeat(43) },
  origin, timezone: 'Etc/GMT-2', accounts: [] };
const cookieHeader = (header: string | string[] | number | undefined) => String(header).split(';')[0]!;

test('scrypt amb sal, comprovació constant i formats restringits', async () => {
  assert(validPasswordHash(hash));
  assert.notEqual(hash, await hashPassword(password));
  assert(await verifyPassword(password, hash));
  assert.equal(await verifyPassword('incorrecte', hash), false);
  assert.equal(await verifyPassword(password, hash.replace('32768', '1073741824')), false);
  await assert.rejects(hashPassword('curta'));
});

test('accés tancat sense contrasenya configurada', async (t) => {
  const app = await buildApp(); t.after(() => app.close());
  assert.deepEqual((await app.inject('/api/auth/session')).json(), { authenticated: false, configured: false });
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { ...headers, origin: 'http://127.0.0.1:5174' }, payload: { password } });
  assert.equal(login.statusCode, 503);
  assert.deepEqual(login.json(), { error: 'AUTH_NOT_CONFIGURED' });
  assert.equal((await app.inject('/api/accounts')).statusCode, 401);
});

test('cookie segura, accés autenticat, rotació i revocació', async (t) => {
  let reads = 0;
  const app = await buildApp({ privateConfig: config, accountsService: { async snapshot() { reads++; return { generatedAt: new Date().toISOString(), accounts: [] }; } } });
  t.after(() => app.close());
  assert.equal((await app.inject('/api/accounts')).statusCode, 401); assert.equal(reads, 0);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });
  assert.equal(login.statusCode, 200);
  const setCookie = String(login.headers['set-cookie']);
  for (const flag of ['__Host-brevo-session=', 'HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert(setCookie.includes(flag));
  assert(!login.body.includes(hash)); assert(!setCookie.includes(password));
  const cookie = cookieHeader(setCookie);
  assert.equal((await app.inject({ url: '/api/accounts', headers: { cookie } })).statusCode, 200); assert.equal(reads, 1);
  assert.equal((await app.inject({ url: '/api/accounts', headers: { cookie: cookie + 'tampered' } })).statusCode, 401);
  assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, true);
  const next = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { ...headers, cookie }, payload: { password } });
  assert.equal(next.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/accounts', headers: { cookie } })).statusCode, 401);
  const second = cookieHeader(next.headers['set-cookie']);
  const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { ...headers, cookie: second } });
  assert.equal(logout.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/accounts', headers: { cookie: second } })).statusCode, 401);
});

test('origen explícit i capçalera obligatòria per login i logout', async (t) => {
  const app = await buildApp({ privateConfig: config }); t.after(() => app.close());
  for (const invalid of [{}, { origin }, { ...headers, origin: 'https://evil.test' }, { ...headers, 'sec-fetch-site': 'cross-site' }]) {
    for (const url of ['/api/auth/login', '/api/auth/logout']) {
      const result = await app.inject({ method: 'POST', url, headers: invalid, payload: { password } });
      assert.equal(result.statusCode, 403); assert.deepEqual(result.json(), { error: 'FORBIDDEN' });
    }
  }
});

test('contrasenya incorrecta, cos limitat i bloqueig de força bruta', async (t) => {
  const app = await buildApp({ privateConfig: config }); t.after(() => app.close());
  const oversized = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password: 'x'.repeat(257) } });
  assert.equal(oversized.statusCode, 400);
  for (let i = 0; i < 4; i++) {
    const result = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password: 'incorrecte' } });
    assert.equal(result.statusCode, 401); assert.deepEqual(result.json(), { error: 'UNAUTHORIZED' });
  }
  const limited = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });
  assert.equal(limited.statusCode, 429); assert.deepEqual(limited.json(), { error: 'RATE_LIMITED' });
});

test('sessió caduca als set dies i un reinici no recupera sessions', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const app = await buildApp({ privateConfig: config }); t.after(() => app.close());
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } });
  const cookie = cookieHeader(login.headers['set-cookie']);
  const other = await buildApp({ privateConfig: config }); t.after(() => other.close());
  assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, true);
  assert.equal((await other.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, false);
  t.mock.timers.tick(7 * 24 * 60 * 60 * 1000);
  assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, readFile, rm, symlink, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/password.js';
import { normalizeNames, readAccountNames, saveAccountNames } from '../src/account-names.js';
import { loadPrivateConfig, type PrivateConfig } from '../src/private-config.js';
import { AccountsService } from '../src/brevo.js';

const password = 'synthetic-settings-password';
const hash = await hashPassword(password);
const origin = 'https://miniapp.example.test';
const headers = { origin, 'x-app-request': '1' };
const config: PrivateConfig = { auth: { passwordHash: hash, sessionSecret: 's'.repeat(43) }, origin,
  production: true, timezone: 'Etc/GMT-2', accounts: [
    { id: '1', name: 'Inicial 1', apiKey: null }, { id: '2', name: 'Inicial 2', apiKey: null },
  ] };
const names = { '1': 'Personal', '2': 'Projectes' };
const cookieOf = (response: { headers: Record<string, unknown> }) => String(response.headers['set-cookie']).split(';')[0]!;
const login = async (app: Awaited<ReturnType<typeof buildApp>>) => cookieOf(await app.inject({ method: 'POST', url: '/api/auth/login', headers, payload: { password } }));
const save = (app: Awaited<ReturnType<typeof buildApp>>, cookie: string, value: unknown = { names }) => app.inject({
  method: 'POST', url: '/api/settings/accounts', headers: { ...headers, cookie, 'content-type': 'application/json' }, payload: JSON.stringify(value),
});

test('noms: només amb sessió i origen vàlid; GET i POST no-store', async (t) => {
  let writes = 0;
  const app = await buildApp({ privateConfig: config, namesWriter: async () => { writes++; } }); t.after(() => app.close());
  assert.equal((await app.inject('/api/settings/accounts')).statusCode, 401);
  assert.equal((await save(app, '')).statusCode, 401);
  const cookie = await login(app);
  const current = await app.inject({ url: '/api/settings/accounts', headers: { cookie } });
  assert.equal(current.headers['cache-control'], 'no-store');
  assert.deepEqual(current.json(), { names: { '1': 'Inicial 1', '2': 'Inicial 2' } });
  for (const bad of [{}, { origin }, { ...headers, origin: 'https://evil.test' }, { ...headers, 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await app.inject({ method: 'POST', url: '/api/settings/accounts', headers: { ...bad, cookie }, payload: { names } })).statusCode, 403);
  }
  assert.equal(writes, 0);
  const changed = await save(app, cookie); assert.equal(changed.statusCode, 200);
  assert.equal(changed.headers['cache-control'], 'no-store'); assert.deepEqual(changed.json(), { names });
});

test('noms: validació estricta, trim, Unicode i noms duplicats permesos', async (t) => {
  let writes = 0;
  const app = await buildApp({ privateConfig: config, namesWriter: async () => { writes++; } }); t.after(() => app.close());
  const cookie = await login(app);
  for (const invalid of [{}, { names: { '1': 'Personal' } }, { names: { ...names, '1': '   ' } },
    { names: { ...names, '2': 'a'.repeat(101) } }, { names: { ...names, '1': 'line\nbreak' } },
    { names: { ...names, '3': 'extra' } }, { names, extra: true }, { names: { ...names, '1': null } }]) {
    assert.equal((await save(app, cookie, invalid)).statusCode, 400);
  }
  assert.equal(writes, 0);
  assert.deepEqual(normalizeNames({ '1': '  Àmbit personal ✉️ ', '2': 'Àmbit personal ✉️' }), { '1': 'Àmbit personal ✉️', '2': 'Àmbit personal ✉️' });
  assert.deepEqual((await save(app, cookie, { names: { '1': '  Personal ', '2': 'Projectes  ' } })).json(), { names });
});

test('noms persistents entre sessions i reinicis, sense modificar claus ni hash', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-names-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const keys = join(directory, 'accounts.env'), auth = join(directory, 'auth.env');
  await writeFile(keys, '', { mode: 0o600 });
  const bootstrap = `APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${'s'.repeat(43)}\n`;
  await writeFile(auth, bootstrap, { mode: 0o600 });
  const env = { BREVO_SECRETS_FILE: keys, AUTH_SECRETS_FILE: auth, PUBLIC_ORIGIN: origin, NODE_ENV: 'production',
    BREVO_ACCOUNT_1_NAME: 'Entorn 1', BREVO_ACCOUNT_2_NAME: 'Entorn 2' };
  const initial = await loadPrivateConfig(env);
  const service = new AccountsService(initial.accounts, initial.timezone); // Sense claus: cap petició real.
  const app = await buildApp({ privateConfig: initial, accountsService: service }); t.after(() => app.close());
  const first = await login(app), second = await login(app);
  assert.equal((await save(app, first)).statusCode, 200);
  assert.deepEqual((await app.inject({ url: '/api/settings/accounts', headers: { cookie: second } })).json(), { names });
  assert.deepEqual((await app.inject({ url: '/api/accounts', headers: { cookie: second } })).json().accounts.map((a: { name: string }) => a.name), Object.values(names));
  assert.equal((await lstat(initial.accountNamesFile!)).mode & 0o777, 0o600);
  assert.equal((await lstat(join(directory, 'access'))).mode & 0o777, 0o700);
  assert.equal(await readFile(auth, 'utf8'), bootstrap); assert.equal(await readFile(keys, 'utf8'), '');
  await assert.rejects(lstat(initial.passwordFile!), { code: 'ENOENT' });
  assert.deepEqual(await readdir(join(directory, 'access')), ['account-names.json']);
  const next = await loadPrivateConfig(env); assert.deepEqual(next.accounts.map(a => a.name), Object.values(names));
  const restarted = await buildApp({ privateConfig: next }); t.after(() => restarted.close());
  assert.deepEqual((await restarted.inject({ url: '/api/settings/accounts', headers: { cookie: await login(restarted) } })).json(), { names });
});

test('noms: fallada del desament conserva els anteriors; sense writer retorna 503', async (t) => {
  for (const writer of [undefined, async () => { throw new Error('private-canary'); }]) {
    const app = await buildApp({ privateConfig: config, ...(writer ? { namesWriter: writer } : {}) }); t.after(() => app.close());
    const cookie = await login(app); const failed = await save(app, cookie);
    assert.equal(failed.statusCode, writer ? 500 : 503); assert(!failed.body.includes('private-canary'));
    assert.deepEqual((await app.inject({ url: '/api/settings/accounts', headers: { cookie } })).json(), { names: { '1': 'Inicial 1', '2': 'Inicial 2' } });
    assert.equal((await app.inject({ url: '/api/auth/session', headers: { cookie } })).json().authenticated, true);
  }
});

test('noms: només un desament alhora i màxim deu intents per minut', async (t) => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(r => { entered = r; }), gate = new Promise<void>(r => { release = r; });
  const app = await buildApp({ privateConfig: config, namesWriter: async () => { entered(); await gate; } }); t.after(() => app.close());
  const cookie = await login(app), first = save(app, cookie);
  await started; assert.equal((await save(app, cookie)).statusCode, 429);
  release(); assert.equal((await first).statusCode, 200);
  const limited = await buildApp({ privateConfig: config, namesWriter: async () => {} }); t.after(() => limited.close());
  const session = await login(limited);
  for (let i = 0; i < 10; i++) assert.equal((await save(limited, session)).statusCode, 200);
  assert.equal((await save(limited, session)).statusCode, 429);
});

test('noms: fitxer privat fora del checkout, permisos, enllaços i dades invàlides rebutjats', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-names-store-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'account-names.json');
  assert.equal(await readAccountNames(file), null); await saveAccountNames(file, names); assert.deepEqual(await readAccountNames(file), names);
  await chmod(file, 0o644); await assert.rejects(readAccountNames(file)); await chmod(file, 0o600);
  const link = join(directory, 'link.json'); await symlink(file, link); await assert.rejects(saveAccountNames(link, names)); await assert.rejects(readAccountNames(link));
  await assert.rejects(saveAccountNames(join(process.cwd(), 'private-names-test', 'account-names.json'), names));
  await assert.rejects(readAccountNames('relative.json'));
  await writeFile(file, JSON.stringify({ ...names, 'extra': 'bad' })); await assert.rejects(readAccountNames(file));
  const keys = join(directory, 'accounts.env'), auth = join(directory, 'auth.env');
  await writeFile(keys, '', { mode: 0o600 }); await writeFile(auth, `APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${'s'.repeat(43)}\n`, { mode: 0o600 });
  await assert.rejects(loadPrivateConfig({ BREVO_SECRETS_FILE: keys, AUTH_SECRETS_FILE: auth, ACCOUNT_NAMES_FILE: file }));
});

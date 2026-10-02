import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPrivateConfig, readPrivateEnv } from '../src/private-config.js';
import { hashPassword } from '../src/password.js';

test('fitxer privat fora del checkout, regular, propi i 0600', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-private-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, 'accounts.env');
  await writeFile(file, 'BREVO_ACCOUNT_1_API_KEY=synthetic-key\n', { mode: 0o600 });
  assert.equal((await readPrivateEnv(file))['BREVO_ACCOUNT_1_API_KEY'], 'synthetic-key');
  await chmod(file, 0o644); await assert.rejects(readPrivateEnv(file)); await chmod(file, 0o600);
  const link = join(directory, 'link.env'); await symlink(file, link); await assert.rejects(readPrivateEnv(link));
  await assert.rejects(readPrivateEnv(join(process.cwd(), 'package.json')));
  assert.deepEqual(await readPrivateEnv(join(directory, 'absent.env'), true), {});
  await assert.rejects(readPrivateEnv(join(directory, 'absent.env')));
});

test('configuració privada completa; producció exigeix accés i HTTPS', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-config-test-')); t.after(() => rm(directory, { recursive: true, force: true }));
  const keys = join(directory, 'accounts.env'), auth = join(directory, 'auth.env');
  await writeFile(keys, 'BREVO_ACCOUNT_1_API_KEY=synthetic-key\n', { mode: 0o600 });
  const hash = await hashPassword('synthetic-password-only');
  await writeFile(auth, `APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${'a'.repeat(43)}\n`, { mode: 0o600 });
  const env = { BREVO_SECRETS_FILE: keys, AUTH_SECRETS_FILE: auth };
  const result = await loadPrivateConfig(env);
  assert.equal(result.accounts[0]!.apiKey, 'synthetic-key'); assert.equal(result.accounts[1]!.apiKey, null);
  assert.equal(result.timezone, 'Etc/GMT-2'); assert.equal(result.auth!.passwordHash, hash);
  await assert.rejects(loadPrivateConfig({ ...env, NODE_ENV: 'production' }), /PUBLIC_ORIGIN/);
  assert.equal((await loadPrivateConfig({ ...env, NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://miniapp.example.com' })).origin, 'https://miniapp.example.com');
  await assert.rejects(loadPrivateConfig({ ...env, NODE_ENV: 'production', PUBLIC_ORIGIN: 'http://brevo.test' }));
  await assert.rejects(loadPrivateConfig({ ...env, SESSION_SECRET: 'short' }));
  await assert.rejects(loadPrivateConfig({ ...env, PUBLIC_ORIGIN: 'http://127.0.0.1:5174/path' }));
  await assert.rejects(loadPrivateConfig({ ...env, BREVO_TIMEZONE: 'invalid' }));
  await writeFile(auth, '', { mode: 0o600 });
  assert.equal((await loadPrivateConfig(env)).auth, null);
  await assert.rejects(loadPrivateConfig({ ...env, NODE_ENV: 'production', PUBLIC_ORIGIN: 'https://miniapp.example.com' }), /Cal configurar/);
});

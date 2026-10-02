import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../src/app.js';
import { readConfig } from '../src/config.js';

test('salut mínima i cap dada del compte sense autenticació', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const health = await app.inject('/api/health');
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: 'ok', service: 'brevo-miniapp' });
  assert.equal(health.headers['cache-control'], 'no-store');
  for (const method of ['GET', 'POST'] as const) {
    const result = await app.inject({ method, url: '/api/accounts' });
    assert.equal(result.statusCode, 401);
    assert.deepEqual(result.json(), { error: 'UNAUTHORIZED' });
    assert.equal(result.headers['cache-control'], 'no-store');
  }
});

test('errors sense URLs, configuració o detalls privats', async (t) => {
  const app = await buildApp();
  app.get('/failure', () => { throw new Error('secret-canary'); });
  t.after(() => app.close());
  const response = await app.inject('/failure');
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { error: 'INTERNAL_ERROR' });
  assert(!response.body.includes('secret-canary'));
  assert.deepEqual((await app.inject('/missing')).json(), { error: 'NOT_FOUND' });
});

test('servidor conjunt: recursos compilats, API JSON i fitxers privats bloquejats', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'brevo-static-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<!doctype html><title>Test</title>');
  await writeFile(join(directory, 'assets', 'main-abc123.js'), 'console.log("test")');
  await writeFile(join(directory, '.env'), 'DO_NOT_SERVE=private');
  const app = await buildApp({ serveWeb: true, webRoot: directory });
  t.after(() => app.close());
  const index = await app.inject('/');
  assert.equal(index.statusCode, 200);
  assert.equal(index.headers['cache-control'], 'no-store');
  assert.match(String(index.headers['content-security-policy']), /frame-ancestors 'none'/);
  const asset = await app.inject('/assets/main-abc123.js');
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
  for (const url of ['/.env', '/%2eenv', '/api/missing', '/../../.env']) {
    const response = await app.inject(url);
    assert.equal(response.statusCode, 404, url);
    assert(!response.body.includes('DO_NOT_SERVE'));
  }
  assert.equal((await app.inject('/api/accounts')).statusCode, 401);
});

test('peticions JSON invàlides o massa grans es rebutgen amb errors públics', async (t) => {
  const app = await buildApp();
  t.after(() => app.close());
  const invalid = await app.inject({ method: 'POST', url: '/api/accounts', headers: { 'content-type': 'application/json' }, payload: '{' });
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.json(), { error: 'BAD_REQUEST' });
  const large = await app.inject({ method: 'POST', url: '/api/accounts', payload: { data: 'a'.repeat(20_000) } });
  assert.equal(large.statusCode, 413);
  assert.deepEqual(large.json(), { error: 'PAYLOAD_TOO_LARGE' });
});

test('el servei escolta només localment per defecte i valida el port', () => {
  assert.deepEqual(readConfig({}), { host: '127.0.0.1', port: 3000, production: false });
  for (const port of ['0', '-1', '65536', '3000oops']) assert.throws(() => readConfig({ PORT: port }));
  assert.throws(() => readConfig({ HOST: '0.0.0.0' }));
  assert.equal(readConfig({ HOST: '0.0.0.0', NODE_ENV: 'production' }).host, '0.0.0.0');
});

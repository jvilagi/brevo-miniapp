import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../src/api.ts';

test('sessió: exigeix dos booleans i conserva cookies sense cache', async t => {
  let value: unknown = { authenticated: false, configured: true };
  const fetch = t.mock.method(globalThis, 'fetch', async (path: string, init: RequestInit) => {
    assert.equal(path, '/api/auth/session'); assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'same-origin'); return Response.json(value);
  });
  assert.deepEqual(await api.session(new AbortController().signal), value);
  for (value of [null, [], {}, { authenticated: 'false', configured: true }, { authenticated: false, configured: null }]) {
    await assert.rejects(api.session(new AbortController().signal), error => error instanceof api.ApiFailure && error.status === 502);
  }
  assert.equal(fetch.mock.callCount(), 6);
});
test('sessió: límit de 10 segons encara que fetch no respongui a abort', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined;
  const fetch = t.mock.method(globalThis, 'fetch', (_path: string, init: RequestInit) => {
    signal = init.signal!; return new Promise<Response>(() => {});
  });
  const pending = assert.rejects(api.session(new AbortController().signal), { name: 'TimeoutError' });
  t.mock.timers.tick(api.SESSION_TIMEOUT_MS - 1); assert.equal(signal?.aborted, false);
  t.mock.timers.tick(1); await pending;
  assert.equal(signal?.aborted, true); assert.equal(fetch.mock.callCount(), 1);
});
test('sessió: el límit també cobreix un cos JSON pendent', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let reading = false;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json() { reading = true; return new Promise(() => {}); } } as unknown as Response));
  const pending = assert.rejects(api.session(new AbortController().signal), { name: 'TimeoutError' });
  await Promise.resolve(); assert(reading);
  t.mock.timers.tick(api.SESSION_TIMEOUT_MS); await pending;
});
test('sessió: cancel·lació abans/durant fetch i neteja després de completar', async t => {
  const external = new AbortController(); external.abort();
  let internal: AbortSignal | undefined, complete = false;
  const fetch = t.mock.method(globalThis, 'fetch', async (_path: string, init: RequestInit) => {
    internal = init.signal!;
    return complete ? Response.json({ authenticated: false, configured: true }) : new Promise<Response>(() => {});
  });
  await assert.rejects(api.session(external.signal), { name: 'AbortError' }); assert.equal(fetch.mock.callCount(), 0);
  const active = new AbortController();
  const pending = assert.rejects(api.session(active.signal), { name: 'AbortError' });
  active.abort(); await pending; assert.equal(internal?.aborted, true);
  complete = true; const finished = new AbortController(); await api.session(finished.signal);
  finished.abort(); assert.equal(internal?.aborted, false, 'Listener retirat en acabar la petició');
});
test('POST: límit de 30 segons sense cap reintent automàtic', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', (_path: string, init: RequestInit) => {
    assert.equal(init.method, 'POST'); return new Promise<Response>(() => {});
  });
  const pending = assert.rejects(api.login('synthetic-timeout-only'), { name: 'TimeoutError' });
  t.mock.timers.tick(30_000); await pending; t.mock.timers.tick(60_000);
  assert.equal(fetch.mock.callCount(), 1);
});

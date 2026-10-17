import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

async function worker() {
  const listeners = new Map<string, (event: any) => void>();
  const notifications: unknown[] = [], opened: string[] = [];
  let clients: { url: string; focus?: () => Promise<void> }[] = [];
  const source = (await readFile(new URL('../pwa/service-worker.js', import.meta.url), 'utf8'))
    .replace('__CACHE_NAME__', 'synthetic-static').replace('__STATIC_FILES__', '["/index.html"]');
  runInNewContext(source, { URL, self: {
    location: { origin: 'https://miniapp.example.test' },
    addEventListener: (type: string, listener: (event: any) => void) => listeners.set(type, listener),
    registration: { async showNotification(...args: unknown[]) { notifications.push(args); } },
    clients: { async matchAll() { return clients; }, async openWindow(url: string) { opened.push(url); } },
  } });
  const dispatch = async (type: string, fields = {}) => {
    let pending: Promise<unknown> | undefined;
    listeners.get(type)!({ ...fields, waitUntil: (value: Promise<unknown>) => { pending = value; } }); await pending;
  };
  return { listeners, notifications, opened, dispatch, setClients: (value: typeof clients) => { clients = value; } };
}
test('push: missatge genèric sense dades del payload ni consulta de l’API', async () => {
  const w = await worker();
  await w.dispatch('push', { data: { text: () => 'private-account-balance-canary' } });
  assert.equal(w.notifications.length, 1); assert(!JSON.stringify(w.notifications).includes('canary'));
  assert.match(JSON.stringify(w.notifications), /Obre la MiniApp/);
});
test('push: el clic enfoca l’app existent o obre només el mateix origen', async () => {
  const w = await worker(); let focused = 0, closed = 0;
  w.setClients([{ url: 'https://miniapp.example.test/', async focus() { focused++; } }]);
  await w.dispatch('notificationclick', { notification: { close() { closed++; }, data: { path: 'https://evil.test' } } });
  assert.equal(focused, 1); assert.equal(closed, 1); assert.equal(w.opened.length, 0);
  w.setClients([]); await w.dispatch('notificationclick', { notification: { close() {} } });
  assert.deepEqual(w.opened, ['https://miniapp.example.test/']);
});
test('worker: API, POST i recursos aliens mai entren en cache', async () => {
  const w = await worker();
  for (const [url, method] of [['https://miniapp.example.test/api/workspace', 'GET'], ['https://miniapp.example.test/index.html', 'POST'], ['https://evil.test/index.html', 'GET'],
    ['https://miniapp.example.test/?recovery=1', 'GET'], ['https://miniapp.example.test/index.html?recovery=1', 'GET']]) {
    let intercepted = false;
    w.listeners.get('fetch')!({ request: new Request(url!, { method }), respondWith() { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});

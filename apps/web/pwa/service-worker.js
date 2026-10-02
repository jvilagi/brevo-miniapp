/* Només app shell públic i recursos estàtics de la llista de compilació. */
const CACHE_PREFIX = 'brevo-static-';
const CACHE_NAME = '__CACHE_NAME__';
const STATIC_FILES = __STATIC_FILES__;
const allowed = new Set(STATIC_FILES);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(STATIC_FILES.map(async (path) => {
      const response = await fetch(path, { credentials: 'omit', cache: 'reload', redirect: 'error' });
      if (!response.ok || response.type !== 'basic') throw new Error('Recurs estàtic no disponible.');
      await cache.put(path, response);
    }));
  })());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // L'API, els POST, els tercers i URLs amb query són sempre xarxa: mai caches.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
    url.search || request.headers.has('authorization')) return;
  if (request.mode === 'navigate' && ['/', '/index.html'].includes(url.pathname)) {
    event.respondWith((async () => (await caches.open(CACHE_NAME)).match('/index.html').then((cached) => cached ?? fetch(request)))());
    return;
  }
  if (!allowed.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // No s'afegeixen respostes de runtime: només els estàtics precachejats.
    return (await cache.match(url.pathname)) ?? fetch(request);
  })());
});

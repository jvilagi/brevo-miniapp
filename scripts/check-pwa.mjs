import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildApp } from '../apps/api/dist/app.js';
import { hashPassword } from '../apps/api/dist/password.js';

const { chromium } = await import(process.env['PLAYWRIGHT_MODULE_PATH'] ?? 'playwright');
const directory = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/pwa/', import.meta.url));
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(join(directory, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/');
assert.equal(manifest.id, '/'); assert.equal(manifest.theme_color, '#0b996f');
assert.equal(manifest.background_color, '#ffffff');
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const png = await readFile(join(directory, 'icons', name));
  assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
}
const html = await readFile(join(directory, 'index.html'), 'utf8');
const source = await readFile(join(directory, 'sw.js'), 'utf8');
const cacheName = source.match(/const CACHE_NAME = '([^']+)'/)[1];
assert(!source.includes('__STATIC_FILES__'));
for (const asset of ['/brand/miniapp-mark.svg']) {
  assert(source.includes(asset), `Recurs de marca inclòs a la cache estàtica: ${asset}`);
}
const password = 'synthetic-pwa-password-only';
const period = { startDate: '2026-09-25', endDate: '2026-10-01', timezone: 'Etc/GMT-2' };
const missing = { data: null, status: 'unavailable', updatedAt: null, error: 'BREVO_UNAVAILABLE' };
const account = (id) => ({ id, name: `Compte ${id}`, source: 'brevo', quota: missing,
  smtp: { source: 'smtp', period, today: { period, report: missing }, totals: missing, daily: missing },
  marketing: { source: 'marketing', period, campaigns: missing },
});
const config = { production: false, auth: { passwordHash: await hashPassword(password), sessionSecret: 's'.repeat(43) },
  accounts: [], origin: '', timezone: period.timezone };
const app = await buildApp({ serveWeb: true, privateConfig: config, accountsService: { async snapshot() {
  return { generatedAt: new Date().toISOString(), accounts: [account('1'), account('2')], privacyCanary: 'pwa-private-canary' };
} } });
let secondVersion = false;
app.get('/sw.js', async (_request, reply) => reply.type('application/javascript').send(secondVersion ?
  source.replace(cacheName, `${cacheName}-test-v2`) + '\n// Versió sintètica de prova.\n' : source));
app.get('/index.html', async (_request, reply) => reply.type('text/html').send(html + (secondVersion ? '\n<!--pwa-v2-marker-->' : '')));
const base = await app.listen({ host: '127.0.0.1', port: 0 }); config.origin = base;
let browser;
try {
  browser = await chromium.launch({ ...(process.env['CHROME_EXECUTABLE'] ? { executablePath: process.env['CHROME_EXECUTABLE'] } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const pageErrors = []; page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(base); await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const login = await context.request.post(`${base}/api/auth/login`, { headers: { origin: base, 'x-app-request': '1' }, data: { password } });
  assert.equal(login.status(), 200);
  const result = await page.evaluate(async () => (await fetch('/api/accounts', { cache: 'no-store' })).json());
  assert.equal(result.privacyCanary, 'pwa-private-canary');
  await page.evaluate(async () => { await fetch('/api/health?probe=1'); await fetch('/manifest.webmanifest?probe=1'); });
  async function inspectCaches() {
    const cached = await page.evaluate(async () => {
      const output = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        output.push({ name, urls: requests.map((request) => request.url), contents: await Promise.all(requests.map(async (request) => (await cache.match(request)).text())) });
      }
      return output;
    });
    assert(cached.length > 0);
    for (const cache of cached) {
      assert(cache.name.startsWith('brevo-static-'));
      for (const url of cache.urls) { assert(!url.includes('/api/')); assert.equal(new URL(url).search, ''); }
      assert(!cache.contents.some((value) => value.includes('pwa-private-canary') || value.includes(password)));
    }
    return cached;
  }
  const initialCaches = await inspectCaches();
  for (const asset of ['/brand/miniapp-mark.svg']) {
    assert(initialCaches.some((cache) => cache.urls.some((url) => new URL(url).pathname === asset)), 'Recursos de marca disponibles offline');
  }
  await context.setOffline(true); await page.reload();
  await page.getByRole('heading', { name: 'No podem connectar' }).waitFor();
  const apiOffline = await page.evaluate(async () => { try { await fetch('/api/accounts'); return false; } catch { return true; } });
  assert(apiOffline, 'L’API no pot respondre des de la cache');
  await page.screenshot({ path: join(output, 'offline.png'), fullPage: true });
  await context.setOffline(false); await page.getByRole('button', { name: 'Torna-ho a provar' }).click();
  await page.locator('.account-1').waitFor();
  secondVersion = true;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.getByRole('button', { name: 'Actualitza l’app', exact: true }).waitFor();
  const oldHtml = await page.evaluate(async () => (await fetch('/index.html')).text());
  assert(!oldHtml.includes('pwa-v2-marker'), 'La versió anterior continua activa fins que l’usuari accepta');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Actualitza l’app', exact: true }).click()]);
  await page.locator('.account-1').waitFor();
  const newHtml = await page.evaluate(async () => (await fetch('/index.html')).text()); assert(newHtml.includes('pwa-v2-marker'));
  const cached = await inspectCaches(); assert.equal(cached.length, 1); assert.equal(cached[0].name, `${cacheName}-test-v2`);
  await page.getByRole('button', { name: 'Tanca la sessió' }).click();
  await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
  const afterLogout = await page.evaluate(async () => (await fetch('/api/accounts')).status); assert.equal(afterLogout, 401);
  await inspectCaches(); assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log('PWA: manifest, icones, estàtics offline, API mai cachejada, logout i actualització controlada correctes.');
} finally { await browser?.close(); await app.close(); }

import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildApp } from '../apps/api/dist/app.js';

// Només un servidor temporal i respostes de sessió sintètiques; cap credencial real.
const { chromium } = await import(process.env['PLAYWRIGHT_MODULE_PATH'] ?? 'playwright');
const directory = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const output = fileURLToPath(new URL('../test-results/startup/', import.meta.url));
await mkdir(output, { recursive: true });
const html = await readFile(join(directory, 'index.html'), 'utf8');
const source = await readFile(join(directory, 'sw.js'), 'utf8');
const cacheName = source.match(/const CACHE_NAME = '([^']+)'/)[1];
const config = { production: false, auth: null, accounts: [], origin: '', timezone: 'Etc/GMT-2' };
const app = await buildApp({ serveWeb: true, privateConfig: config });
let secondVersion = false;
app.get('/sw.js', async (_request, reply) => reply.type('application/javascript').send(secondVersion ? source.replace(cacheName, `${cacheName}-startup-v2`) : source));
app.get('/', async (_request, reply) => reply.type('text/html').send(html + '\n<!--startup-network-marker-->'));
const base = await app.listen({ host: '127.0.0.1', port: 0 }); config.origin = base;
let browser;
try {
  browser = await chromium.launch({ ...(process.env['CHROME_EXECUTABLE'] ? { executablePath: process.env['CHROME_EXECUTABLE'] } : {}), headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); page.setDefaultTimeout(30_000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let mode = 'ok', calls = 0; const held = [];
  await page.route('**/api/auth/session', async route => {
    calls++;
    if (mode === 'pending') { held.push(route); return; }
    await route.fulfill({ json: mode === 'invalid' ? null : { authenticated: false, configured: true } });
  });
  const login = () => page.getByRole('heading', { name: 'Benvingut', exact: true }).waitFor();
  const pending = async () => {
    mode = 'pending'; const before = calls; await page.reload();
    await page.getByRole('status').filter({ hasText: 'Preparant' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.connection-screen .primary-button') !== null);
    assert(calls > before); return calls;
  };
  async function noOverflow() {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Sense desbordament horitzontal');
  }
  await page.goto(base); await login();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await pending();
  assert.equal(await page.getByRole('button', { name: 'Torna-ho a provar', exact: true }).count(), 1);
  assert.equal(await page.locator('.connection-screen .pwa-controls').count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Carrega l’última versió' }).getAttribute('href'), '/?recovery=1');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 }); await noOverflow();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('heading', { name: 'No podem connectar' }).waitFor();
  await page.screenshot({ path: join(output, 'timeout-mobile.png'), fullPage: true });
  mode = 'ok'; await page.getByRole('button', { name: 'Torna-ho a provar', exact: true }).click(); await login();
  for (const route of held.splice(0)) await route.fulfill({ json: { authenticated: true, configured: true } }).catch(() => {});
  await login(); assert.equal(await page.locator('.dashboard-shell').count(), 0, 'Resposta obsoleta ignorada');
  console.log('Arrencada: timeout real, controls visibles i reintent manual correctes.');

  await pending(); mode = 'ok';
  await page.getByRole('button', { name: 'Torna-ho a provar', exact: true }).click(); await login();
  const beforeResume = await pending();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide'));
  });
  assert.equal(calls, beforeResume, 'Cap consulta nova en segon pla'); mode = 'ok';
  await page.evaluate(() => {
    delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('pageshow'));
  });
  await login(); assert.equal(calls, beforeResume + 1, 'Represa simultània coalescent');
  const beforeJump = await pending(); mode = 'ok';
  await page.evaluate(() => {
    const now = Date.now; Date.now = () => now() + 11_000;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await login(); assert.equal(calls, beforeJump + 1, 'Termini real comprovat encara que els timers estiguin suspesos');
  await pending(); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByRole('heading', { name: 'No podem connectar' }).waitFor();
  mode = 'ok'; await page.evaluate(() => window.dispatchEvent(new Event('online'))); await login();
  mode = 'invalid'; await page.reload(); await page.getByRole('heading', { name: 'No podem connectar' }).waitFor();
  console.log('Arrencada: cancel·lació, represa, rellotge, offline/online i resposta invàlida correctes.');

  await pending(); secondVersion = true;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.getByRole('button', { name: 'Actualitza l’app', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.serviceWorker.controller.scriptURL.endsWith('/sw.js')), true);
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting !== null), true, 'Actualització no activada sense consentiment');
  mode = 'ok';
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'Actualitza l’app', exact: true }).click()]);
  await login();
  const response = await page.goto(`${base}/?recovery=1`); await login();
  assert((await response.text()).includes('startup-network-marker'), 'Recuperació força HTML de xarxa, no la còpia del worker');
  const cached = await page.evaluate(async () => {
    const urls = [];
    for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) urls.push(request.url);
    return urls;
  });
  assert(cached.length > 0); assert(cached.every(url => !new URL(url).search && !new URL(url).pathname.startsWith('/api/')));
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log('Arrencada: actualització durant l’espera i recuperació sense esborrar dades correctes.');
} finally { await browser?.close(); await app.close(); }

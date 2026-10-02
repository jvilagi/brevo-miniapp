import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Comprovació pública, sense contrasenya ni accés als fitxers privats.
const origin = process.env['DEPLOY_CHECK_ORIGIN'];
assert(origin, 'Defineix DEPLOY_CHECK_ORIGIN amb el teu origen HTTPS.');
assert.equal(new URL(origin).protocol, 'https:');
assert.equal(new URL(origin).origin, origin);
const { chromium } = await import(process.env['PLAYWRIGHT_MODULE_PATH'] ?? 'playwright');
const output = fileURLToPath(new URL('../test-results/deploy/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env['CHROME_EXECUTABLE'] ? { executablePath: process.env['CHROME_EXECUTABLE'] } : {}),
});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(origin);
  assert.equal(response.status(), 200);
  await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
  assert.equal(await page.locator('.login-intro').count(), 0);
  await page.locator('.brand-symbol').waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const result = await page.evaluate(async () => {
    const manifest = await (await fetch('/manifest.webmanifest')).json();
    const session = await (await fetch('/api/auth/session', { cache: 'no-store' })).json();
    const privateStatus = (await fetch('/api/accounts', { cache: 'no-store' })).status;
    const cacheFiles = [];
    for (const key of await caches.keys()) {
      for (const request of await (await caches.open(key)).keys()) cacheFiles.push(new URL(request.url).pathname);
    }
    return { manifest, session, privateStatus, cacheFiles,
      persistentData: localStorage.length + sessionStorage.length,
      overflow: document.documentElement.scrollWidth > innerWidth,
      worker: navigator.serviceWorker.controller.scriptURL,
    };
  });
  assert.deepEqual(result.session, { authenticated: false, configured: true });
  assert.equal(result.privateStatus, 401);
  assert.equal(result.manifest.display, 'standalone');
  assert.equal(result.manifest.start_url, '/');
  assert.equal(result.manifest.theme_color, '#0b996f');
  assert.equal(result.manifest.background_color, '#ffffff');
  assert(result.cacheFiles.includes('/brand/miniapp-mark.svg'));
  assert(!result.cacheFiles.some((path) => /brevo-(?:mark|wordmark)/.test(path)));
  assert(result.cacheFiles.includes('/index.html'));
  assert(!result.cacheFiles.some((path) => path.startsWith('/api/')));
  assert.equal(result.persistentData, 0);
  assert.equal(result.overflow, false);
  assert.equal(result.worker, `${origin}/sw.js`);
  for (const icon of result.manifest.icons) {
    const response = await context.request.get(`${origin}${icon.src}`);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['content-type'], 'image/png');
  }
  await page.screenshot({ path: join(output, 'https-login-mobile.png'), fullPage: true });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'No podem connectar' }).waitFor();
  const offlineApi = await page.evaluate(async () => {
    try { await fetch('/api/accounts'); return false; } catch { return true; }
  });
  assert.equal(offlineApi, true);
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Torna-ho a provar' }).click();
  await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
  assert.deepEqual(errors, []);
  console.info('Desplegament HTTPS: accés privat, manifest, icones, service worker, offline estàtic i represa correctes.');
  await context.close();
} finally { await browser.close(); }

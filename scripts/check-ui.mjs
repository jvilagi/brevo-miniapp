// Dades exclusivament sintètiques; no es llegeix cap fitxer privat.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { buildApp } from '../apps/api/dist/app.js';
import { hashPassword } from '../apps/api/dist/password.js';
import { normalizeSmtpMetrics } from '../apps/api/dist/normalize.js';

const { chromium, webkit } = await import(process.env['PLAYWRIGHT_MODULE_PATH'] ?? 'playwright');
const directory = fileURLToPath(new URL('../test-results/ui/', import.meta.url));
await mkdir(directory, { recursive: true });
const password = 'synthetic-ui-password-only';
const period = { startDate: '2026-09-25', endDate: '2026-10-01', timezone: 'Etc/GMT-2' };
const metrics = normalizeSmtpMetrics({ requests: 150, delivered: 135, opens: 68, uniqueOpens: 40, clicks: 12, uniqueClicks: 7, blocked: 14, hardBounces: 1, softBounces: 0, invalid: 0, unsubscribed: 0, spamReports: 0 });
const section = (data) => ({ data, status: 'fresh', updatedAt: '2026-10-01T11:56:00Z', error: null });
const makeAccount = (id) => ({ id, name: `Compte ${id}`, source: 'brevo',
  quota: section(id === '1' ? { regime: 'prepaid', available: 8400, dailyLimit: null } : { regime: 'free', available: 249, dailyLimit: 300 }),
  smtp: { source: 'smtp', period, today: { period: { ...period, startDate: period.endDate }, report: section(id === '1' ? metrics : Object.fromEntries(Object.keys(metrics).map((metric) => [metric, 0]))) },
    totals: section({ ...metrics, requests: 1200, uniqueOpens: 518 }),
    daily: section({ days: [20, 0, 45, 110, 75, null, 150].map((requests, index) => ({ date: index < 6 ? `2026-09-${25 + index}` : '2026-10-01', currentDay: index === 6,
      metrics: normalizeSmtpMetrics({ ...metrics, requests }), zeroFilled: [] })) }),
  }, marketing: { source: 'marketing', period, campaigns: section({ count: 0 }) },
});
const fixture = { generatedAt: '2026-10-01T11:56:00Z', accounts: [makeAccount('1'), makeAccount('2')] };
const config = { auth: { passwordHash: await hashPassword(password), sessionSecret: 's'.repeat(43) }, production: false,
  origin: '', timezone: period.timezone, accounts: [] };
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Desbordament horitzontal');
}
function contrast(a, b) {
  const luminance = (color) => color.match(/[\d.]+/g).slice(0, 3).map((value) => Number(value) / 255)
    .map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
async function verify(browserType, label, executablePath) {
  const testConfig = { ...config };
  const app = await buildApp({ serveWeb: true, privateConfig: testConfig, accountsService: { async snapshot() { return structuredClone(fixture); } } });
  const base = await app.listen({ host: '127.0.0.1', port: 0 }); testConfig.origin = base;
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch(executablePath ? { executablePath, headless: true } : { headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base); await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.brand-symbol')].every((image) => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.brand-symbol[src="/brand/miniapp-mark.svg"]').count(), 1);
    assert.equal(await page.locator('.brand-name').innerText(), 'MiniApp\nper a Brevo');
    assert.equal(await page.locator('.brand-mark').count(), 0, 'Marca provisional retirada');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await page.locator('.login-lock').evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(215, 254, 200)');
    for (const selector of ['.login-card > p', '.install-button']) {
      const color = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).color);
      assert(contrast(color, 'rgb(255, 255, 255)') >= 4.5, `Contrast del text: ${selector}`);
    }
    const primary = await page.locator('.primary-button').evaluate((element) => ({ color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundImage }));
    assert(primary.background.includes('rgb(44, 44, 44)'));
    assert(contrast(primary.color, 'rgb(44, 44, 44)') >= 4.5, 'Contrast del botó principal');
    assert.equal(await page.locator('.login-intro, .intro-chips').count(), 0);
    assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1);
    for (const text of ['MENYS CLICS. MÉS CLAREDAT.', 'Els teus comptes.', 'D’un cop d’ull.',
      'Consum, saldo i activitat de Brevo, en un sol lloc.', '2 comptes', '7 dies d’activitat', 'Només consulta']) {
      assert.equal(await page.getByText(text, { exact: true }).count(), 0, `Text retirat del login: ${text}`);
    }
    for (const width of [320, 375, 390, 430, 760, 761, 1280]) {
      await page.setViewportSize({ width, height: 900 }); await noOverflow(page);
      const bounds = await page.locator('.login-card').boundingBox();
      assert(bounds && Math.abs(bounds.x + bounds.width / 2 - width / 2) < 2, 'Formulari centrat');
      assert(bounds.width <= 440, 'Amplada màxima del formulari');
    }
    await page.screenshot({ path: join(directory, `${label}-login-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page); await page.screenshot({ path: join(directory, `${label}-login.png`), fullPage: true });
    await page.getByLabel('Contrasenya').fill('incorrecte'); await page.getByRole('button', { name: 'Entra a la MiniApp' }).click();
    await page.getByRole('alert').filter({ hasText: 'no és correcta' }).waitFor();
    assert.equal(await page.getByLabel('Contrasenya').inputValue(), '');
    await page.getByLabel('Contrasenya').fill(password); await page.getByRole('button', { name: 'Entra a la MiniApp' }).click();
    await page.locator('.account-card.account-1').waitFor();
    assert.equal(await page.locator('.account-card').count(), 2);
    assert.equal(await page.getByRole('meter', { name: 'Saldo Free disponible segons Brevo' }).getAttribute('aria-valuenow'), '249');
    assert.equal(await page.locator('.account-2 .today-number strong').innerText(), '0');
    assert.equal(await page.locator('.account-2 .balance-number strong').innerText(), '249');
    assert.equal(await page.locator('.account-2 .balance-number .number-label').innerText(), 'Saldo disponible');
    assert.equal(await page.locator('.account-2 .balance-number .number-source').innerText(), 'Segons Brevo · quota de 300/dia');
    assert((await page.locator('.account-2 .account-note').innerText()).includes('hora exacta no està verificada'));
    assert(!(await page.locator('.account-2').innerText()).includes('00:00'));
    assert.equal(await page.locator('.account-1 .balance-number strong').innerText(), '8.400');
    await noOverflow(page); await page.screenshot({ path: join(directory, `${label}-overview.png`), fullPage: true });
    const card = page.locator('.account-1');
    await card.getByRole('button', { name: 'Estadístiques i evolució' }).click();
    for (const [metric, color] of [['delivered', 'rgb(38, 117, 192)'], ['opens', 'rgb(21, 159, 159)']]) {
      await card.getByLabel('Mètrica del gràfic').selectOption(metric);
      assert.equal(await card.locator('.chart-line').evaluate((element) => getComputedStyle(element).stroke), color);
      assert(contrast(color, 'rgb(255, 255, 255)') >= 3, `Contrast del gràfic: ${metric}`);
    }
    await card.getByRole('button', { name: 'Últims 7 dies', exact: true }).click();
    await card.getByText('Totes les mètriques').click();
    assert.equal(await card.locator('.metric-list > div').filter({ hasText: 'Obertures úniques reportades' }).locator('dd').innerText(), '518');
    await card.getByText('Totes les mètriques').click();
    await card.getByLabel('Mètrica del gràfic').selectOption('clicks');
    assert.equal(await card.locator('.chart-line').evaluate((element) => getComputedStyle(element).stroke), 'rgb(11, 153, 111)');
    await card.locator('.chart-days button').first().click();
    assert.equal(await card.locator('.chart-days button').first().getAttribute('aria-pressed'), 'true');
    await card.getByLabel('Mètrica del gràfic').selectOption('requests');
    assert.equal(await card.locator('.chart-line').evaluate((element) => getComputedStyle(element).stroke), 'rgb(99, 88, 222)');
    assert.equal(await card.locator('.stats-grid dt .icon').count(), 4, 'Icones de mètriques presents');
    const chartBounds = await card.locator('.chart').boundingBox();
    await card.locator('.chart').click({ position: { x: chartBounds.width / 2, y: chartBounds.height / 2 } });
    assert.equal(await card.locator('.chart-days button').nth(3).getAttribute('aria-pressed'), 'true');
    await card.locator('.chart-days button').nth(5).click();
    assert.equal(await card.locator('.chart-readout strong').innerText(), '—');
    await card.locator('.chart-days button').last().click();
    await noOverflow(page); await page.screenshot({ path: join(directory, `${label}-expanded.png`), fullPage: true });
    for (const width of [320, 375, 430, 1280]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
    await page.screenshot({ path: join(directory, `${label}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    let readCalls = 0;
    await page.route('**/api/accounts', async (route) => { readCalls++; await route.abort(); });
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No s’han pogut actualitzar' }).waitFor();
    assert((await page.locator('.provenance.is-warning').count()) >= 4);
    const before = readCalls; await page.waitForTimeout(1200); assert.equal(readCalls, before, 'No hi ha polling');
    await page.unroute('**/api/accounts');
    await page.route('**/api/accounts', async (route) => {
      const partial = structuredClone(fixture); partial.accounts[1].quota = { data: null, status: 'unavailable', updatedAt: null, error: 'BREVO_UNAVAILABLE' };
      await route.fulfill({ json: partial });
    });
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.locator('.account-2 .balance-number strong').getByText('—', { exact: true }).waitFor();
    await noOverflow(page); await page.screenshot({ path: join(directory, `${label}-partial.png`), fullPage: true });
    await page.unroute('**/api/accounts');
    await page.route('**/api/accounts', async (route) => { await route.fulfill({ status: 401, json: { error: 'UNAUTHORIZED' } }); });
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.getByRole('heading', { name: 'Benvingut' }).waitFor(); assert.equal(await page.locator('.account-card').count(), 0);
    await page.unroute('**/api/accounts');
    await page.getByLabel('Contrasenya').fill(password); await page.getByRole('button', { name: 'Entra a la MiniApp' }).click();
    await page.locator('.account-card.account-1').waitFor();
    await page.getByRole('button', { name: 'Tanca la sessió' }).click();
    await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
    const unauthorized = await context.request.get(`${base}/api/accounts`); assert.equal(unauthorized.status(), 401);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.deepEqual(errors, []);
    await context.close(); console.log(`${label}: accés, dades, gràfic, errors, sessió i amplades 320–1280 correctes.`);
  } finally { await browser?.close(); await app.close(); }
}
const engines = (process.env['UI_BROWSERS'] ?? 'chromium').split(',');
if (engines.some((engine) => !['chromium', 'webkit'].includes(engine))) throw new Error('UI_BROWSERS ha de ser chromium, webkit o tots dos separats per coma.');
if (engines.includes('chromium')) await verify(chromium, 'chromium', process.env['CHROME_EXECUTABLE']);
if (engines.includes('webkit')) await verify(webkit, 'webkit');

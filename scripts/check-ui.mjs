// Dades exclusivament sintètiques; no es llegeix cap fitxer privat.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { buildApp } from '../apps/api/dist/app.js';
import { hashPassword } from '../apps/api/dist/password.js';
import { normalizeSmtpMetrics } from '../apps/api/dist/normalize.js';
import { Workspace } from '../apps/api/dist/workspace.js';
import { generatePushKeys } from '../apps/api/dist/push-alerts.js';

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
  const temporary = await mkdtemp(join(tmpdir(), 'brevo-ui-workspace-'));
  const testConfig = { ...config, workspaceFile: join(temporary, 'workspace.sealed.json'), accounts: ['1', '2'].map(id => ({ id, name: `Compte ${id}`, apiKey: `synthetic-credential-${id}-only` })) };
  const workspace = await Workspace.open(testConfig);
  const app = await buildApp({ serveWeb: true, privateConfig: testConfig, passwordWriter: async () => {}, namesWriter: async () => {},
    workspace, brevoClient: { async get(_key, endpoint) { return endpoint === '/v3/senders' ? { senders: [{ active: true, id: 8, name: 'Remitent de prova', email: 'sender@example.test' }] } : { plan: [{ type: 'free', creditsType: 'sendLimit', credits: 249 }] }; } },
    accountsService: { async snapshot() { return { ...structuredClone(fixture), accounts: workspace.accounts().map(account => makeAccount(account.id)) }; } } });
  const base = await app.listen({ host: '127.0.0.1', port: 0 }); testConfig.origin = base;
  const errors = [];
  let browser;
  try {
    browser = await browserType.launch(executablePath ? { executablePath, headless: true } : { headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__testNowOffset = 0;
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + window.__testNowOffset;
    });
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
    await page.waitForFunction(() => /^Fa \d+ s$/.test(document.querySelector('.refresh-age').textContent));
    assert.equal(await page.locator('.refresh-age').getAttribute('aria-live'), 'off');
    // Saltem el rellotge del client sense dormir ni provocar polling.
    await page.evaluate(() => { window.__testNowOffset = 45000; window.dispatchEvent(new Event('focus')); });
    await page.waitForFunction(() => /^Fa 4\d s$/.test(document.querySelector('.refresh-age').textContent));
    await page.getByRole('button', { name: 'Configuració', exact: true }).click();
    await page.getByRole('heading', { name: 'Configuració', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edita Compte 1', exact: true }).click();
    assert.equal(await page.getByLabel('Nom del compte', { exact: true }).inputValue(), 'Compte 1');
    await page.getByLabel('Nom del compte', { exact: true }).fill('Nom no desat');
    await page.getByRole('button', { name: 'Cancel·la', exact: true }).click();
    await page.getByRole('button', { name: 'Edita Compte 1', exact: true }).click();
    assert.equal(await page.getByLabel('Nom del compte', { exact: true }).inputValue(), 'Compte 1');
    await page.getByLabel('Nom del compte', { exact: true }).fill(' ');
    await page.getByRole('button', { name: 'Desa el compte', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'entre 1 i 100' }).waitFor();
    await page.getByLabel('Nom del compte', { exact: true }).fill('Personal ✉️');
    await page.getByLabel('Icona', { exact: true }).selectOption('work');
    await page.getByLabel('Color', { exact: true }).selectOption('blue');
    await page.getByLabel('Pla contractat (referència)', { exact: true }).selectOption('subscription');
    await page.getByLabel('Emails o crèdits contractats', { exact: true }).fill('5000');
    await page.getByLabel('Dia de renovació (mensual)', { exact: true }).fill('12');
    await page.getByLabel('Avisa si el saldo és ≤', { exact: true }).fill('100');
    for (const width of [320, 375, 390, 430, 1280]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
    await page.setViewportSize({ width: 390, height: 900 });
    // Pausa acotada de composició després dels canvis seguits de viewport.
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.brand-symbol').count(), 1);
    assert.equal(await page.locator('footer').innerText(), 'Brevo MiniApp · Accés privat');
    await page.getByLabel('Dia de renovació (mensual)', { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(directory, `${label}-account-editor-bottom.png`) });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(directory, `${label}-account-editor.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/workspace/accounts/1', async route => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { error: 'INTERNAL_ERROR' } });
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Desa el compte', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No s’ha pogut confirmar' }).waitFor();
    assert.equal(await page.getByLabel('Nom del compte', { exact: true }).inputValue(), 'Personal ✉️');
    await page.unroute('**/api/workspace/accounts/1');
    await page.getByRole('button', { name: 'Desa el compte', exact: true }).click();
    await page.getByRole('button', { name: 'Edita Personal ✉️', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edita Compte 2', exact: true }).click();
    await page.getByLabel('Nom del compte', { exact: true }).fill('Projectes');
    await page.getByRole('button', { name: 'Desa el compte', exact: true }).click();
    await page.getByRole('button', { name: 'Afegeix un compte', exact: true }).click();
    await page.getByLabel('Nom del compte', { exact: true }).fill('Tercer compte');
    await page.getByLabel('Clau API de Brevo', { exact: true }).fill('synthetic-third-private-key-only');
    await page.getByLabel('Contrasenya actual de la MiniApp', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Desa el compte', exact: true }).click();
    await page.getByRole('button', { name: 'Edita Tercer compte', exact: true }).waitFor();
    assert.equal(await page.locator('.managed-account').count(), 3);
    await page.getByRole('button', { name: 'Puja Tercer compte', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Ordre desat.' }).waitFor();
    assert.equal(await page.locator('.managed-account h2').nth(1).innerText(), 'Tercer compte');
    await page.getByRole('button', { name: 'Edita Tercer compte', exact: true }).click();
    await page.getByLabel('Contrasenya actual de la MiniApp', { exact: true }).fill(password);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Desconnecta de la MiniApp', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Compte desconnectat' }).waitFor();
    assert.equal(await page.locator('.managed-account').count(), 2);
    await page.screenshot({ path: join(directory, `${label}-settings.png`), fullPage: true });
    await page.getByRole('button', { name: 'Avisos', exact: true }).click();
    await page.getByLabel('Activa els avisos per correu', { exact: true }).check();
    await page.getByLabel('Correu destinatari', { exact: true }).fill('recipient@example.test');
    await page.getByLabel('Compte Brevo que paga els avisos', { exact: true }).selectOption('2');
    await page.getByLabel('Remitent actiu d’aquest compte', { exact: true }).selectOption('8');
    await page.getByLabel('Contrasenya de la MiniApp per desar o provar', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Desa els avisos', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Configuració dels avisos desada.' }).waitFor();
    assert(await page.getByRole('button', { name: 'Envia una prova als canals actius', exact: true }).isDisabled());
    // Simulador PushManager: cap permís del SO, cap registre o enviament extern real.
    await page.evaluate(fixture => {
      let subscription = null;
      const registration = { pushManager: {
        async getSubscription() { return subscription; },
        async subscribe() { subscription = { endpoint: fixture.endpoint, toJSON: () => fixture, async unsubscribe() { subscription = null; return true; } }; return subscription; },
      } };
      Notification.requestPermission = async () => 'denied';
      Object.defineProperty(navigator.serviceWorker, 'ready', { configurable: true, value: Promise.resolve(registration) });
      navigator.serviceWorker.getRegistration = async () => registration;
    }, { endpoint: 'https://web.push.apple.com/synthetic-ui-endpoint', keys: { auth: randomBytes(16).toString('base64url'), p256dh: generatePushKeys().publicKey } });
    await page.getByRole('button', { name: 'Activa en aquest dispositiu', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No s’ha donat permís' }).waitFor();
    await page.evaluate(() => { Notification.requestPermission = async () => 'granted'; });
    await page.getByRole('button', { name: 'Activa en aquest dispositiu', exact: true }).click();
    await page.getByRole('button', { name: 'Desactiva en aquest dispositiu', exact: true }).waitFor();
    assert.equal(workspace.settings().pushDevices.length, 1);
    await page.getByRole('button', { name: 'Desactiva en aquest dispositiu', exact: true }).click();
    await page.getByRole('button', { name: 'Activa en aquest dispositiu', exact: true }).waitFor();
    assert.equal(workspace.settings().pushDevices.length, 0);
    for (const width of [320, 375, 390, 430, 1280]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.screenshot({ path: join(directory, `${label}-alerts.png`), fullPage: true });
    await page.getByRole('button', { name: 'Torna als comptes', exact: true }).click();
    await page.locator('.account-1 h2').getByText('Personal ✉️', { exact: true }).waitFor();
    assert.equal(await page.locator('.account-2 h2').innerText(), 'Projectes');
    assert.equal(await page.locator('.account-1.color-blue').count(), 1);
    const peer = await browser.newContext();
    assert.equal((await peer.request.post(`${base}/api/auth/login`, { headers: { origin: base, 'x-app-request': '1' }, data: { password } })).status(), 200);
    assert.deepEqual(await (await peer.request.get(`${base}/api/settings/accounts`)).json(), { names: { '1': 'Personal ✉️', '2': 'Projectes' } });
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.refresh-button').disabled);
    assert.equal(await page.locator('.account-1 h2').innerText(), 'Personal ✉️');
    await page.evaluate(() => { window.__testNowOffset = 0; });
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.waitForFunction(() => /^Fa \d+ s$/.test(document.querySelector('.refresh-age').textContent));
    await noOverflow(page); await page.screenshot({ path: join(directory, `${label}-overview.png`), fullPage: true });
    let balanceFixture = { regime: 'subscription', available: 1200, dailyLimit: null, prepaidAvailable: 4800 };
    let balanceStatus = 'fresh';
    let declaredPlan = 'auto';
    await page.route('**/api/accounts', async route => {
      const monthly = structuredClone(fixture);
      monthly.accounts[0].quota = { ...section(balanceFixture), status: balanceStatus };
      monthly.accounts[0].reference = { kind: declaredPlan, allowance: null, renewalDay: null };
      await route.fulfill({ json: monthly });
    });
    const refreshBalances = async () => {
      await Promise.all([page.waitForResponse(response => response.url() === `${base}/api/accounts`), page.getByRole('button', { name: 'Actualitza', exact: true }).click()]);
      await page.waitForFunction(() => !document.querySelector('.refresh-button').disabled);
    };
    await refreshBalances();
    await page.locator('.account-1 .prepaid-number strong').getByText('4.800', { exact: true }).waitFor();
    assert.equal(await page.locator('.account-1 .balance-number strong').innerText(), '1.200');
    assert.equal(await page.locator('.account-1 .balance-number .number-label').innerText(), 'Emails del pla');
    assert.equal(await page.locator('.account-1 .plan-badge').innerText(), 'Pla + prepagament');
    assert.deepEqual(await page.locator('.account-1 .account-numbers > div').evaluateAll(elements => elements.map(element => element.className)), ['today-number', 'prepaid-number', 'balance-number']);
    assert(!/primer els emails|després els crèdits/.test(await page.locator('.account-1 .account-note').innerText()));
    assert.equal(await page.locator('.account-1 .prepaid-number .number-label').innerText(), 'Crèdits prepagament');
    assert.equal(await page.locator('.account-1 .today-number strong').innerText(), '150');
    for (const width of [320, 375, 390, 430, 760, 761, 1280]) {
      await page.setViewportSize({ width, height: 900 }); await noOverflow(page);
      const left = await page.locator('.account-1 .prepaid-number strong').boundingBox(), right = await page.locator('.account-1 .balance-number strong').boundingBox();
      assert(left && right && left.x < right.x && Math.abs(left.y - right.y) < 2, 'Prepagament primer, saldos independents alineats');
      if ([390, 1280].includes(width)) { await page.waitForTimeout(150); await page.locator('.account-1').screenshot({ path: join(directory, `${label}-dual-balance-${width}.png`) }); }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    balanceFixture = { ...balanceFixture, prepaidAvailable: 4781 }; await refreshBalances();
    await page.locator('.account-1 .prepaid-number strong').getByText('4.781', { exact: true }).waitFor();
    assert.equal(await page.locator('.account-1 .balance-number strong').innerText(), '1.200', 'Consum prepagament no resta emails del pla');
    assert.equal(await page.locator('.account-1 .today-number strong').innerText(), '150', 'No es reconcilia el saldo restant SMTP');
    declaredPlan = 'free'; balanceFixture = { ...balanceFixture, available: 285 }; await refreshBalances();
    assert.match(await page.locator('.account-1 .account-note').innerText(), /Pla declarat Free/);
    assert.match(await page.locator('.account-1 .account-note').innerText(), /No són dos saldos disponibles alhora/);
    assert.match(await page.locator('.account-1 .balance-number .number-source').innerText(), /no s’afegeix al prepagament/);
    assert.equal(await page.locator('.account-1 .prepaid-number strong').innerText(), '4.781');
    assert.equal(await page.locator('.account-1 .balance-number strong').innerText(), '285', 'Declarar Free no força un saldo de 300');
    await noOverflow(page); await page.locator('.account-1').screenshot({ path: join(directory, `${label}-free-prepaid-390.png`) });
    declaredPlan = 'auto';
    balanceFixture = { ...balanceFixture, prepaidAvailable: 4800 }; await refreshBalances();
    balanceFixture = { ...balanceFixture, available: 0 }; await refreshBalances();
    await page.locator('.account-1 .balance-number strong').getByText('0', { exact: true }).waitFor();
    assert.equal(await page.locator('.account-1 .prepaid-number strong').innerText(), '4.800');
    balanceFixture = { ...balanceFixture, prepaidAvailable: 0 }; await refreshBalances();
    await page.locator('.account-1 .prepaid-number strong').getByText('0', { exact: true }).waitFor();
    balanceFixture = { ...balanceFixture, prepaidAvailable: null }; await refreshBalances();
    await page.locator('.account-1 .prepaid-number strong').getByText('—', { exact: true }).waitFor();
    assert.equal(await page.locator('.account-1 .balance-number strong').innerText(), '0');
    assert.match(await page.locator('.account-1 .prepaid-number .number-source').innerText(), /no disponible/);
    balanceFixture = { ...balanceFixture, available: 1200, prepaidAvailable: 4800 }; balanceStatus = 'stale'; await refreshBalances();
    assert.match(await page.locator('.account-1 .balance-number .provenance').innerText(), /Dada antiga/);
    assert.match(await page.locator('.account-1 .prepaid-number .provenance').innerText(), /Dada antiga/);
    await page.unroute('**/api/accounts'); await refreshBalances();
    await page.locator('.account-1 .balance-number strong').getByText('8.400', { exact: true }).waitFor();
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
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange')); window.__testNowOffset = 135000;
    });
    const frozen = await page.locator('.refresh-age').innerText(), hiddenCalls = readCalls;
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.refresh-age').innerText(), frozen, 'Rellotge aturat en segon pla');
    assert.equal(readCalls, hiddenCalls, 'Sense polling ocult');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => /^Fa 2 min 1\d s$/.test(document.querySelector('.refresh-age').textContent));
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'No s’han pogut actualitzar' }).waitFor();
    assert.match(await page.locator('.refresh-age').innerText(), /^Fa 2 min/);
    assert((await page.locator('.provenance.is-warning').count()) >= 4);
    const before = readCalls; await page.waitForTimeout(1200); assert.equal(readCalls, before, 'No hi ha polling');
    await page.unroute('**/api/accounts');
    await page.route('**/api/accounts', async route => {
      const old = structuredClone(fixture);
      for (const account of old.accounts) for (const section of [account.quota, account.smtp.today.report, account.smtp.totals, account.smtp.daily, account.marketing.campaigns]) section.status = 'stale';
      await route.fulfill({ json: old });
    });
    await page.getByRole('button', { name: 'Actualitza', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Algunes dades' }).waitFor();
    assert.match(await page.locator('.refresh-age').innerText(), /^Fa 2 min/);
    await page.unroute('**/api/accounts');
    await page.evaluate(() => { window.__testNowOffset = 0; });
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
    await page.getByRole('button', { name: 'Canvia la contrasenya', exact: true }).click();
    await page.getByRole('heading', { name: 'Canvia la contrasenya', exact: true }).waitFor();
    const nextPassword = 'synthetic-ui-new-password-only';
    await page.getByLabel('Contrasenya actual', { exact: true }).fill(password);
    await page.getByLabel('Contrasenya nova', { exact: true }).fill(nextPassword);
    await page.getByLabel('Confirma la contrasenya nova', { exact: true }).fill('different-synthetic-password');
    let passwordCalls = 0;
    await page.route('**/api/auth/password', async (route) => { passwordCalls++; await route.continue(); });
    await page.getByRole('button', { name: 'Desa la contrasenya', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'no coincideixen' }).waitFor(); assert.equal(passwordCalls, 0);
    await page.getByRole('button', { name: 'Cancel·la', exact: true }).click();
    await page.getByRole('button', { name: 'Canvia la contrasenya', exact: true }).click();
    for (const input of await page.locator('.password-card input').all()) assert.equal(await input.inputValue(), '');
    for (const width of [320, 375, 390, 430, 1280]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(directory, `${label}-password.png`), fullPage: true });
    await page.getByLabel('Contrasenya actual', { exact: true }).fill('wrong');
    await page.getByLabel('Contrasenya nova', { exact: true }).fill(nextPassword);
    await page.getByLabel('Confirma la contrasenya nova', { exact: true }).fill(nextPassword);
    await page.getByRole('button', { name: 'Desa la contrasenya', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'actual no és correcta' }).waitFor();
    for (const input of await page.locator('.password-card input').all()) assert.equal(await input.inputValue(), '');
    const other = peer;
    await page.getByLabel('Contrasenya actual', { exact: true }).fill(password);
    await page.getByLabel('Contrasenya nova', { exact: true }).fill(nextPassword);
    await page.getByLabel('Confirma la contrasenya nova', { exact: true }).fill(nextPassword);
    await page.getByRole('button', { name: 'Desa la contrasenya', exact: true }).click();
    await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
    await page.getByRole('status').filter({ hasText: 'Contrasenya actualitzada' }).waitFor();
    assert.equal(await page.locator('.account-card').count(), 0);
    assert.equal((await other.request.get(`${base}/api/accounts`)).status(), 401); await other.close();
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.unroute('**/api/auth/password');
    await page.getByLabel('Contrasenya').fill(nextPassword); await page.getByRole('button', { name: 'Entra a la MiniApp' }).click();
    await page.locator('.account-card.account-1').waitFor();
    await page.getByRole('button', { name: 'Tanca la sessió' }).click();
    await page.getByRole('heading', { name: 'Benvingut' }).waitFor();
    const unauthorized = await context.request.get(`${base}/api/accounts`); assert.equal(unauthorized.status(), 401);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    assert.deepEqual(errors, []);
    await context.close(); console.log(`${label}: accés, comptes dinàmics, plans, aparença, avisos sense enviament real, temporitzador, gràfic, errors, contrasenya, sessions i amplades 320–1280 correctes.`);
  } finally { await browser?.close(); await app.close(); await rm(temporary, { recursive: true, force: true }); }
}
const engines = (process.env['UI_BROWSERS'] ?? 'chromium').split(',');
if (engines.some((engine) => !['chromium', 'webkit'].includes(engine))) throw new Error('UI_BROWSERS ha de ser chromium, webkit o tots dos separats per coma.');
if (engines.includes('chromium')) await verify(chromium, 'chromium', process.env['CHROME_EXECUTABLE']);
if (engines.includes('webkit')) await verify(webkit, 'webkit');

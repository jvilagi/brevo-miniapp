import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuota, normalizeSmtpMetrics, sevenDayPeriod } from '../src/normalize.js';

test('el saldo prepagament es llegeix sense sumar la subscripció', () => {
  assert.deepEqual(normalizeQuota({ plan: [
    { type: 'payAsYouGo', creditsType: 'sendLimit', credits: 8700 },
    { type: 'subscription', creditsType: 'sendLimit', credits: 0 },
  ] }), { regime: 'prepaid', available: 8700, dailyLimit: null });
});

test('esgotar el prepagament no implica un retorn a Free', () => {
  assert.deepEqual(normalizeQuota({ plan: [{ type: 'payAsYouGo', creditsType: 'sendLimit', credits: 0 }] }),
    { regime: 'prepaid', available: 0, dailyLimit: null });
});

test('Free usa el saldo de l’API, independentment del consum SMTP', () => {
  assert.deepEqual(normalizeQuota({ plan: [{ type: 'free', creditsType: 'sendLimit', credits: 285 }] }),
    { regime: 'free', available: 285, dailyLimit: 300 });
});

test('plans ambigus, saldos absents i valors invàlids queden desconeguts', () => {
  const unknown = { regime: 'unknown', available: null, dailyLimit: null };
  for (const account of [null, {}, { plan: [] }, { plan: [null] },
    { plan: [{ type: 'free', creditsType: 'sendLimit' }] },
    { plan: [{ type: 'free', creditsType: 'sendLimit', credits: -1 }] },
    { plan: [{ type: 'free', creditsType: 'sendLimit', credits: '285' }] },
    { plan: [{ type: 'subscription', creditsType: 'sendLimit', credits: 20 }, { type: 'free', creditsType: 'sendLimit', credits: 10 }] },
  ]) assert.deepEqual(normalizeQuota(account), unknown);
});
test('subscripció i reserva es presenten per separat, sense sumar-les', () => {
  assert.deepEqual(normalizeQuota({ plan: [{ type: 'subscription', creditsType: 'sendLimit', credits: 20 }, { type: 'payAsYouGo', creditsType: 'sendLimit', credits: 10 }] }),
    { regime: 'subscription', available: 20, dailyLimit: null, prepaidAvailable: 10 });
  assert.deepEqual(normalizeQuota({ plan: [{ type: 'subscription', creditsType: 'sendLimit', credits: 0 }] }),
    { regime: 'subscription', available: 0, dailyLimit: null, prepaidAvailable: null });
});
test('subscripció de pagament esgotada: conserva zero i la reserva separada', () => {
  const plan = [{ type: 'subscription', creditsType: 'sendLimit', credits: 0, startDate: '2026-10-01', endDate: '2026-11-01' }, { type: 'payAsYouGo', creditsType: 'sendLimit', credits: 1200 }];
  assert.deepEqual(normalizeQuota({ plan, planVerticals: [{ planCategory: 'Marketing', planType: 'paid', status: 'active' }] }),
    { regime: 'subscription', available: 0, dailyLimit: null, prepaidAvailable: 1200 });
  for (const vertical of [{ planCategory: 'Marketing', planType: 'paid', status: 'inactive' },
    { planCategory: 'Marketing', planType: 'free', status: 'active' }, { planCategory: 'Chat', planType: 'paid', status: 'active' }]) {
    assert.deepEqual(normalizeQuota({ plan, planVerticals: [vertical] }), { regime: 'prepaid', available: 1200, dailyLimit: null });
  }
  const planVerticals = [{ planCategory: 'Marketing', planType: 'paid', status: 'active' }];
  assert.equal(normalizeQuota({ plan, planVerticals: [...planVerticals, { planCategory: 'Marketing', planType: 'free', status: 'active' }] }).regime, 'prepaid');
  for (const dates of [{ startDate: undefined, endDate: undefined }, { startDate: '2026-02-31', endDate: '2026-04-01' },
    { startDate: '2026-11-01', endDate: '2026-10-01' }]) {
    assert.equal(normalizeQuota({ plan: [{ ...plan[0], ...dates }, plan[1]], planVerticals }).regime, 'prepaid');
  }
  assert.equal(normalizeQuota({ plan: [{ ...plan[0], startDate: String(Date.parse('2026-10-01') / 1000), endDate: String(Date.parse('2026-11-01') / 1000) }, plan[1]], planVerticals }).regime, 'subscription');
});

test('no s’exposen dades personals, claus o camps no contractats', () => {
  const metrics = normalizeSmtpMetrics({ requests: 15, delivered: 15, email: 'private@example.test', key: 'private', other: 10 });
  assert.equal(metrics.requests, 15);
  assert.equal(metrics.opens, null);
  assert(!('email' in metrics));
  assert(!('key' in metrics));
  assert(!('other' in metrics));
});

test('una mètrica absent no és zero i zero explícit es conserva', () => {
  const metrics = normalizeSmtpMetrics({ requests: 0, uniqueOpens: 37, uniqueClicks: 6, opens: -5, clicks: Infinity });
  assert.equal(metrics.requests, 0);
  assert.equal(metrics.delivered, null);
  assert.equal(metrics.opens, null);
  assert.equal(metrics.clicks, null);
  assert.equal(metrics.uniqueOpens, 37);
  assert.equal(metrics.uniqueClicks, 6);
});

test('set dies naturals inclouen avui i respecten mitjanit GMT+2', () => {
  assert.deepEqual(sevenDayPeriod(new Date('2026-09-30T22:00:00Z'), 'Etc/GMT-2'),
    { startDate: '2026-09-25', endDate: '2026-10-01', timezone: 'Etc/GMT-2' });
  assert.equal(sevenDayPeriod(new Date('2026-09-30T21:59:59Z'), 'Etc/GMT-2').endDate, '2026-09-30');
});

test('el període funciona en canvis d’any i anys de traspàs', () => {
  assert.equal(sevenDayPeriod(new Date('2026-01-01T12:00:00Z'), 'Etc/GMT-2').startDate, '2025-12-26');
  assert.equal(sevenDayPeriod(new Date('2024-03-01T12:00:00Z'), 'Etc/GMT-2').startDate, '2024-02-24');
});

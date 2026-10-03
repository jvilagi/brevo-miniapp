import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints, number, quotaPresentation, sectionStatus, updatedLabel } from '../src/presentation';

test('valors desconeguts, zero i format català', () => {
  assert.equal(number(null), '—'); assert.equal(number(undefined), '—'); assert.equal(number(0), '0'); assert.equal(number(8400), '8.400');
});
test('quota Free disponible segons API; prepagament sense barra ni quota inventada', () => {
  const free = quotaPresentation({ regime: 'free', available: 285, dailyLimit: 300 });
  assert.equal(free.available, 285); assert.equal(free.fraction, .95);
  const prepaid = quotaPresentation({ regime: 'prepaid', available: 0, dailyLimit: null });
  assert.equal(prepaid.badge, 'Prepagament'); assert.equal(prepaid.fraction, null); assert.equal(prepaid.available, 0);
  assert.equal(quotaPresentation(null).available, null);
  assert.equal(quotaPresentation({ regime: 'free', available: 301, dailyLimit: 300 }).fraction, null);
});
test('saldo Free independent del dia SMTP i sense hora de reinici no verificada', () => {
  const free = quotaPresentation({ regime: 'free', available: 249, dailyLimit: 300 });
  assert.equal(free.available, 249); assert.equal(free.fraction, 249 / 300);
  assert.equal(free.title, 'Saldo disponible');
  assert.equal(free.source, 'Segons Brevo · quota de 300/dia');
  assert.match(free.note, /hora exacta no està verificada/);
  assert(!JSON.stringify(free).match(/00:00|GMT|Disponibles avui/));
  assert.equal(quotaPresentation({ regime: 'free', available: 300, dailyLimit: 300 }).available, 300);
});
test('gràfic: buits explícits, zeros reals i escala compartida', () => {
  const points = chartPoints([0, null, 20]);
  assert.equal(points[0]!.value, 0); assert.equal(points[1], null); assert.equal(points[2]!.value, 20);
  assert(points[0]!.y > points[2]!.y);
  assert(chartPoints([0, 0]).every((point) => point && Number.isFinite(point.y)));
});
test('dada antiga després d’un error local i fus de la font GMT+2', () => {
  const fresh = { data: 15, status: 'fresh' as const, updatedAt: '2026-10-01T10:00:00Z', error: null };
  assert.equal(sectionStatus(fresh), null); assert.equal(sectionStatus(fresh, true), 'Dada antiga');
  assert.equal(sectionStatus({ ...fresh, status: 'unavailable', data: null }), 'No disponible');
  assert(updatedLabel(fresh.updatedAt, 'Etc/GMT-2').includes('12:00'));
});

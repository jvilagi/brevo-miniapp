import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkspaceSettings } from '@brevo-miniapp/contracts';
import { notificationStatus } from '../src/notification-status';
const settings = (change: Partial<WorkspaceSettings> = {}): WorkspaceSettings => ({
  revision: 0, accounts: [{ id: '1', name: 'Compte de prova', connected: true, appearance: { icon: 'mail', color: 'green' },
    reference: { kind: 'free', allowance: null, renewalDay: null }, lowBalance: 50, lowPercent: null, lowDays: 2 }],
  alerts: { enabled: false, recipient: '', senderAccountId: '', senderId: null, connectionErrors: true, repeatMinutes: 1440 },
  deliveries: [], deliveryEnabled: false, pushEnabled: true,
  pushDevices: [{ id: 'device', label: 'Prova', createdAt: '2026-10-01T10:00:00Z' }], ...change,
});
test('notificacions: registrar push no habilita el servei ni el correu', () => {
  const status = notificationStatus(settings());
  assert.equal(status.service, 'Pausat al servidor'); assert.equal(status.push, 'Registrades · servei pausat');
  assert.equal(status.email, 'Desactivat'); assert.equal(status.pushActive, false); assert.equal(status.monitorActive, false);
});
test('notificacions: push operatives amb el correu desactivat', () => {
  const status = notificationStatus(settings({ deliveryEnabled: true }));
  assert.equal(status.service, 'Habilitat'); assert.equal(status.push, 'Actives al servidor');
  assert.equal(status.pushActive, true); assert.equal(status.emailActive, false); assert.equal(status.monitorActive, true);
});
test('notificacions: sense dispositius o push desactivades no es prometen enviaments', () => {
  assert.equal(notificationStatus(settings({ deliveryEnabled: true, pushDevices: [] })).push, 'Sense dispositius registrats');
  assert.equal(notificationStatus(settings({ deliveryEnabled: true, pushDevices: [] })).monitorActive, false);
  assert.equal(notificationStatus(settings({ deliveryEnabled: true, pushEnabled: false })).push, 'Desactivades');
  assert.equal(notificationStatus(settings({ deliveryEnabled: true, pushEnabled: false })).pushActive, false);
});
test('notificacions: correu incomplet no es presenta com a actiu', () => {
  const s = settings({ deliveryEnabled: true }); s.alerts.enabled = true;
  assert.equal(notificationStatus(s).email, 'Configuració incompleta'); assert.equal(notificationStatus(s).emailActive, false);
  s.alerts = { ...s.alerts, recipient: 'recipient@example.test', senderAccountId: '1', senderId: 8 };
  assert.equal(notificationStatus(s).email, 'Actiu');
  s.accounts[0]!.connected = false;
  assert.equal(notificationStatus(s).email, 'Configuració incompleta');
});
test('notificacions: canals configurats continuen pausats amb el bloqueig global', () => {
  const s = settings(); s.alerts = { ...s.alerts, enabled: true, recipient: 'recipient@example.test', senderAccountId: '1', senderId: 8 };
  assert.equal(notificationStatus(s).email, 'Configurat · servei pausat');
  assert.equal(notificationStatus(s).emailActive, false); assert.equal(notificationStatus(s).pushActive, false);
});

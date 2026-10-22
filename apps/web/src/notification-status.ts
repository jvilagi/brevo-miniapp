import type { WorkspaceSettings } from '@brevo-miniapp/contracts';

// Estat desat del servidor, no una garantia d'entrega al dispositiu.
export function notificationStatus(settings: WorkspaceSettings) {
  const emailConfigured = Boolean(settings.alerts.recipient && settings.alerts.senderId &&
    settings.accounts.some(account => account.id === settings.alerts.senderAccountId && account.connected));
  const emailReady = settings.alerts.enabled && emailConfigured;
  const pushReady = settings.pushEnabled && settings.pushDevices.length > 0;
  return {
    service: settings.deliveryEnabled ? 'Habilitat' : 'Pausat al servidor',
    email: !settings.alerts.enabled ? 'Desactivat' : !emailConfigured ? 'Configuració incompleta' :
      settings.deliveryEnabled ? 'Actiu' : 'Configurat · servei pausat',
    push: !settings.pushDevices.length ? 'Sense dispositius registrats' : !settings.pushEnabled ? 'Desactivades' :
      settings.deliveryEnabled ? 'Actives al servidor' : 'Registrades · servei pausat',
    emailActive: settings.deliveryEnabled && emailReady,
    pushActive: settings.deliveryEnabled && pushReady,
    monitorActive: settings.deliveryEnabled && (emailReady || pushReady),
  };
}

import webpush from 'web-push';
import type { WorkspaceData, PushDevice } from './workspace.js';
export interface PushSender { send(device: PushDevice, keys: NonNullable<WorkspaceData['push']['keys']>): Promise<void> }
export class PushExpired extends Error {}
export class WebPushSender implements PushSender {
  constructor(private origin: string) {}
  async send(device: PushDevice, keys: NonNullable<WorkspaceData['push']['keys']>) {
    try {
      await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, JSON.stringify({ title: 'MiniApp · Avís dels comptes', body: 'Obre la MiniApp per consultar els avisos pendents.' }), {
        vapidDetails: { ...keys, subject: this.origin.startsWith('https:') ? this.origin : 'mailto:admin@example.invalid' }, TTL: 3600, timeout: 15000,
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && [404, 410].includes(Number(error.statusCode))) throw new PushExpired('Subscripció caducada.');
      throw new Error('Push no confirmada.');
    }
  }
}
export const generatePushKeys = () => webpush.generateVAPIDKeys();

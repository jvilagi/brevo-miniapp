import { randomUUID } from 'node:crypto';
import type { DataSection, Quota, SenderOption } from '@brevo-miniapp/contracts';
import type { BrevoReader } from './brevo.js';
import { record, SettingsFailure, Workspace, type WorkspaceData } from './workspace.js';
import { PushExpired, type PushSender } from './push-alerts.js';

export interface AlertSender { send(apiKey: string, senderId: number, recipient: string, subject: string, message: string): Promise<void> }
export class SendRejected extends Error {}
export class BrevoAlertSender implements AlertSender {
  constructor(private fetcher: typeof fetch = fetch) {}
  async send(apiKey: string, senderId: number, recipient: string, subject: string, message: string) {
    // Només aquesta operació explícita pot fer POST a Brevo. No s'envien destinataris de campanyes ni adjunts.
    const response = await this.fetcher('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { id: senderId }, to: [{ email: recipient }], subject,
        textContent: message, htmlContent: `<html><body><pre>${message.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</pre></body></html>`, tags: ['miniapp-alert'] }),
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    await response.body?.cancel();
    if (response.status !== 201) {
      if (response.status >= 400 && response.status < 500) throw new SendRejected('Brevo ha rebutjat l’avís.');
      throw new Error('Enviament no confirmat.');
    }
  }
}
export async function activeSenders(client: BrevoReader, apiKey: string): Promise<SenderOption[]> {
  const response = record(await client.get(apiKey, '/v3/senders'));
  if (!Array.isArray(response.senders) || response.senders.length > 500) throw new SettingsFailure(502);
  return response.senders.flatMap(raw => {
    const value = record(raw);
    if (value.active !== true || !Number.isSafeInteger(value.id) || (value.id as number) <= 0 || typeof value.email !== 'string' || typeof value.name !== 'string') return [];
    return [{ id: value.id as number, email: value.email.slice(0, 254), name: value.name.slice(0, 100) }];
  });
}
type QuotaRow = { id: string; quota: DataSection<Quota> };
export class AlertMonitor {
  private running = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(private workspace: Workspace, private quotas: () => Promise<QuotaRow[]>, private sender: AlertSender,
    private now: () => number = Date.now, private pushSender?: PushSender) {}
  start() {
    if (!this.workspace.deliveryEnabled || this.timer) return;
    this.timer = setInterval(() => { void this.tick().catch(() => {}); }, 300000); this.timer.unref();
    void this.tick().catch(() => {});
  }
  stop() { clearInterval(this.timer); this.timer = undefined; }
  private hasBudget(data: WorkspaceData) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    return data.emailBudget.day !== day || data.emailBudget.attempts < 20;
  }
  private async deliver(keys: string[], message: string, kind: 'alert' | 'test', expectedRevision: number) {
    const settings = this.workspace.settings();
    if (!settings.deliveryEnabled || !settings.alerts.enabled && !settings.pushEnabled) throw new SettingsFailure(503);
    let email = settings.alerts.enabled;
    const account = email ? this.workspace.account(settings.alerts.senderAccountId) : null;
    if (email && (!account?.apiKey || !settings.alerts.recipient || !settings.alerts.senderId)) throw new SettingsFailure(400);
    const push = this.workspace.pushData();
    const id = randomUUID(), at = new Date(this.now()).toISOString();
    await this.workspace.edit(expectedRevision, draft => {
      if (email && !this.hasBudget(draft)) { if (!push.enabled) throw new SettingsFailure(429); email = false; }
      if (email) {
        const day = at.slice(0, 10);
        draft.emailBudget = { day, attempts: (draft.emailBudget.day === day ? draft.emailBudget.attempts : 0) + 1 };
      }
      draft.deliveries = [...draft.deliveries.slice(-98), ...(email ? [{ id, at, accountId: account!.id, kind, channel: 'email' as const, status: 'pending' as const }] : []),
        ...(push.enabled ? [{ id: id + '-push', at, accountId: null, kind, channel: 'push' as const, status: 'pending' as const }] : [])];
      for (const key of keys) draft.incidents[key] = { firstProblem: draft.incidents[key]?.firstProblem ?? null, active: true, lastAttempt: this.now() };
    });
    // La reserva durable precedeix l'enviament: en cas d'aturada o timeout no es reintenta immediatament.
    let status: 'accepted' | 'rejected' | 'uncertain' = 'accepted';
    try { if (email) await this.sender.send(account!.apiKey!, settings.alerts.senderId!, settings.alerts.recipient, kind === 'test' ? 'Prova d’avís · MiniApp' : 'Avís dels comptes · MiniApp', message); }
    catch (error) { status = error instanceof SendRejected ? 'rejected' : 'uncertain'; }
    let pushStatus: 'accepted' | 'uncertain' = 'accepted'; const expired: string[] = [];
    if (push.enabled && push.keys) for (const device of push.devices) {
      try { if (!this.pushSender) throw new Error(); await this.pushSender.send(device, push.keys); }
      catch (error) { pushStatus = 'uncertain'; if (error instanceof PushExpired) expired.push(device.id); }
    }
    await this.workspace.edit(null, draft => {
      const row = draft.deliveries.find(row => row.id === id); if (row) row.status = status;
      const pushed = draft.deliveries.find(row => row.id === id + '-push'); if (pushed) pushed.status = pushStatus;
      draft.push.devices = draft.push.devices.filter(device => !expired.includes(device.id)); if (!draft.push.devices.length) draft.push.enabled = false;
    });
    return status;
  }
  async test(revision: number) {
    if (this.running) throw new SettingsFailure(409); this.running = true;
    try { return await this.deliver([], 'Aquest és un correu de prova de la MiniApp. Es comptabilitza al compte Brevo emissor seleccionat.', 'test', revision); }
    finally { this.running = false; }
  }
  async tick() {
    if (this.running || !this.workspace.deliveryEnabled || !this.workspace.settings().alerts.enabled && !this.workspace.settings().pushEnabled) return;
    this.running = true;
    try {
      const before = this.workspace.settings(), rows = await this.quotas();
      if (this.workspace.settings().revision !== before.revision) return;
      const ready: string[] = [], lines: string[] = [];
      await this.workspace.edit(before.revision, draft => {
        for (const account of draft.accounts) {
          const quota = rows.find(row => row.id === account.id)?.quota;
          const fresh = quota?.status === 'fresh' && quota.data !== null;
          const available = fresh ? quota!.data!.available : null;
          const low = available !== null && (account.lowBalance !== null && available <= account.lowBalance ||
            account.lowPercent !== null && account.reference.allowance !== null && account.reference.allowance > 0 && available / account.reference.allowance * 100 <= account.lowPercent);
          for (const [type, active] of [['balance', low], ['connection', !fresh && draft.alerts.connectionErrors]] as const) {
            if (type === 'balance' && !fresh) continue;
            const key = account.id + ':' + type, previous = draft.incidents[key];
            const firstProblem = active ? previous?.firstProblem ?? this.now() : null;
            const lastAttempt = previous?.lastAttempt ?? null;
            draft.incidents[key] = { active, firstProblem, lastAttempt };
            const waited = type !== 'connection' || firstProblem !== null && this.now() - firstProblem >= 900000;
            // Un pendent incert no es duplica fins al període explícit de repetició.
            if (active && waited && (!previous?.active || lastAttempt === null || this.now() - lastAttempt >= draft.alerts.repeatMinutes * 60000)) {
              ready.push(key);
              const data = quota?.data;
              lines.push(type === 'connection' ? `${account.name}: no s’obtenen dades fresques des de fa almenys 15 minuts.` :
                data?.regime === 'subscription' ? `${account.name}: crèdits prepagament segons Brevo ${data.prepaidAvailable ?? 'no disponibles'}; emails del pla ${available}.` :
                `${account.name}: saldo segons Brevo ${available}.`);
            }
          }
        }
      });
      if (ready.length) await this.deliver(ready, lines.join('\n') + '\n\nConsulta la MiniApp per revisar les dates de cada dada. Aquest avís es comptabilitza al compte emissor.', 'alert', this.workspace.settings().revision);
    } finally { this.running = false; }
  }
}

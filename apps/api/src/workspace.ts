import { createCipheriv, createDecipheriv, ECDH, hkdfSync, randomBytes, randomUUID } from 'node:crypto';
import type { AccountNames, AlertDelivery, Appearance, EmailAlerts, ManagedAccount, PlanReference, WorkspaceSettings } from '@brevo-miniapp/contracts';
import { accountColors, accountIcons } from '@brevo-miniapp/contracts';
import { readPrivateJson, writePrivateJson } from './private-json.js';
import type { AccountConfig, PrivateConfig } from './private-config.js';

export class SettingsFailure extends Error {
  constructor(public status: number) { super('Configuració no disponible.'); }
}
export type PrivateAccount = Omit<ManagedAccount, 'connected'> & { apiKey: string | null };
export interface IncidentState { firstProblem: number | null; lastAttempt: number | null; active: boolean; basis?: 'free' | 'prepaid' | 'subscription' | 'unknown' }
export interface WorkspaceData {
  version: 1; revision: number; accounts: PrivateAccount[]; alerts: EmailAlerts;
  deliveries: AlertDelivery[]; incidents: Record<string, IncidentState>;
  emailBudget: { day: string; attempts: number };
  push: { enabled: boolean; keys: { publicKey: string; privateKey: string } | null; devices: PushDevice[] };
}
export interface PushDevice { id: string; label: string; createdAt: string; endpoint: string; keys: { auth: string; p256dh: string } }
export function pushSubscription(value: unknown): Pick<PushDevice, 'endpoint' | 'keys'> {
  const data = record(value); exact(data, ['endpoint', 'keys', 'expirationTime']);
  const endpoint = text(data.endpoint, 4096), keys = record(data.keys); exact(keys, ['auth', 'p256dh']);
  let url: URL; try { url = new URL(endpoint); } catch { return invalid(); }
  const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com' || url.hostname.endsWith('.push.apple.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !allowed ||
    typeof keys.auth !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth) ||
    typeof keys.p256dh !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh)) return invalid();
  try { ECDH.convertKey(Buffer.from(keys.p256dh, 'base64url'), 'prime256v1'); } catch { return invalid(); }
  return { endpoint, keys: { auth: keys.auth, p256dh: keys.p256dh } };
}
const invalid = () => { throw new SettingsFailure(400); };
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
export function exact(value: Record<string, unknown>, fields: string[]) {
  if (Object.keys(value).some(key => !fields.includes(key))) invalid();
}
export function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) return invalid();
  return value.trim();
}
function nullableCount(value: unknown, max = 1_000_000_000): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max) return invalid();
  return value as number;
}
export const validId = (value: string) => /^[a-zA-Z0-9-]{1,64}$/.test(value);
export function accountInput(value: unknown): Omit<ManagedAccount, 'id' | 'connected'> {
  const item = record(value); exact(item, ['name', 'appearance', 'reference', 'lowBalance', 'lowPercent', 'lowDays']);
  const appearance = record(item.appearance), reference = record(item.reference);
  exact(appearance, ['icon', 'color']); exact(reference, ['kind', 'allowance', 'renewalDay']);
  if (!accountIcons.includes(appearance.icon as Appearance['icon']) || !accountColors.includes(appearance.color as Appearance['color']) ||
    !['auto', 'free', 'prepaid', 'subscription'].includes(String(reference.kind))) return invalid();
  const renewalDay = nullableCount(reference.renewalDay, 31);
  if (renewalDay === 0) return invalid();
  const allowance = nullableCount(reference.allowance), lowPercent = nullableCount(item.lowPercent, 100);
  if (lowPercent !== null && (allowance === null || allowance === 0)) return invalid();
  const lowDays = item.lowDays === undefined ? null : nullableCount(item.lowDays, 365);
  if (lowDays === 0) return invalid();
  return { name: text(item.name, 100), appearance: appearance as unknown as Appearance,
    reference: { kind: reference.kind as PlanReference['kind'], allowance, renewalDay },
    lowBalance: nullableCount(item.lowBalance), lowPercent, lowDays };
}
export function alertInput(value: unknown): EmailAlerts {
  const item = record(value); exact(item, ['enabled', 'recipient', 'senderAccountId', 'senderId', 'connectionErrors', 'repeatMinutes']);
  const recipient = text(item.recipient, 254, true), senderAccountId = text(item.senderAccountId, 64, true);
  const senderId = nullableCount(item.senderId);
  if (typeof item.enabled !== 'boolean' || typeof item.connectionErrors !== 'boolean' ||
    !Number.isInteger(item.repeatMinutes) || (item.repeatMinutes as number) < 60 || (item.repeatMinutes as number) > 10080 ||
    (recipient && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient)) ||
    (senderAccountId && !validId(senderAccountId)) || senderId === 0 ||
    (item.enabled && (!recipient || !senderAccountId || !senderId))) return invalid();
  return { enabled: item.enabled, recipient, senderAccountId, senderId, connectionErrors: item.connectionErrors, repeatMinutes: item.repeatMinutes as number };
}
export function defaultAccount(account: AccountConfig, index: number): PrivateAccount {
  return { ...account, appearance: { icon: 'mail', color: index % 2 ? 'purple' : 'green' },
    reference: { kind: 'auto', allowance: null, renewalDay: null }, lowBalance: null, lowPercent: null, lowDays: null };
}
function validateData(value: unknown): WorkspaceData {
  const data = record(value); exact(data, ['version', 'revision', 'accounts', 'alerts', 'deliveries', 'incidents', 'push', 'emailBudget']);
  if (data.version !== 1 || !Number.isSafeInteger(data.revision) || (data.revision as number) < 0 ||
    !Array.isArray(data.accounts) || data.accounts.length > 25 || !Array.isArray(data.deliveries) || data.deliveries.length > 100) return invalid();
  const ids = new Set<string>();
  const accounts = data.accounts.map(raw => {
    const item = record(raw); exact(item, ['id', 'apiKey', 'name', 'appearance', 'reference', 'lowBalance', 'lowPercent', 'lowDays']);
    if (typeof item.id !== 'string' || !validId(item.id) || ids.has(item.id) ||
      !(item.apiKey === null || typeof item.apiKey === 'string' && item.apiKey.length >= 16 && item.apiKey.length <= 512 && !/\s/.test(item.apiKey))) return invalid();
    ids.add(item.id);
    const { id, apiKey, ...metadata } = item;
    return { ...accountInput(metadata), id: id as string, apiKey: apiKey as string | null };
  });
  const alerts = alertInput(data.alerts);
  const emailBudget = record(data.emailBudget); exact(emailBudget, ['day', 'attempts']);
  if (typeof emailBudget.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(emailBudget.day) || nullableCount(emailBudget.attempts, 20) === null) return invalid();
  if (alerts.enabled && !accounts.some(account => account.id === alerts.senderAccountId && account.apiKey)) return invalid();
  for (const raw of data.deliveries) {
    const delivery = record(raw); exact(delivery, ['id', 'accountId', 'at', 'kind', 'status', 'channel']);
    if (typeof delivery.id !== 'string' || !validId(delivery.id) || !(delivery.accountId === null || typeof delivery.accountId === 'string' && validId(delivery.accountId)) ||
      typeof delivery.at !== 'string' || !Number.isFinite(Date.parse(delivery.at)) || !['alert', 'test'].includes(String(delivery.kind)) ||
      !['email', 'push'].includes(String(delivery.channel)) || !['pending', 'accepted', 'rejected', 'uncertain'].includes(String(delivery.status))) return invalid();
  }
  const incidents = record(data.incidents);
  if (Object.keys(incidents).length > 75) return invalid();
  for (const [key, raw] of Object.entries(incidents)) {
    if (!/^[a-zA-Z0-9-]{1,64}:(balance|connection|forecast)$/.test(key)) return invalid();
    const state = record(raw); exact(state, ['firstProblem', 'lastAttempt', 'active', 'basis']);
    if (typeof state.active !== 'boolean' || state.basis !== undefined && !['free', 'prepaid', 'subscription', 'unknown'].includes(String(state.basis))) return invalid();
    nullableCount(state.firstProblem, Number.MAX_SAFE_INTEGER); nullableCount(state.lastAttempt, Number.MAX_SAFE_INTEGER);
  }
  const push = record(data.push); exact(push, ['enabled', 'keys', 'devices']);
  if (typeof push.enabled !== 'boolean' || !Array.isArray(push.devices) || push.devices.length > 20) return invalid();
  if (push.keys !== null) {
    const keys = record(push.keys); exact(keys, ['publicKey', 'privateKey']);
    if (typeof keys.publicKey !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(keys.publicKey) || typeof keys.privateKey !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(keys.privateKey)) return invalid();
  }
  const endpoints = new Set<string>();
  for (const raw of push.devices) {
    const device = record(raw); exact(device, ['id', 'label', 'createdAt', 'endpoint', 'keys']);
    if (typeof device.id !== 'string' || !validId(device.id) || typeof device.createdAt !== 'string' || !Number.isFinite(Date.parse(device.createdAt))) return invalid();
    text(device.label, 64); pushSubscription({ endpoint: device.endpoint, keys: device.keys });
    if (endpoints.has(device.endpoint as string)) return invalid(); endpoints.add(device.endpoint as string);
  }
  if (push.enabled && (!push.keys || !push.devices.length)) return invalid();
  return { version: 1, revision: data.revision as number, accounts, alerts, push: push as unknown as WorkspaceData['push'],
    deliveries: data.deliveries as AlertDelivery[], incidents: incidents as unknown as WorkspaceData['incidents'], emailBudget: emailBudget as unknown as WorkspaceData['emailBudget'] };
}
function envelope(value: unknown) {
  const item = record(value); exact(item, ['version', 'iv', 'tag', 'ciphertext']);
  if (item.version !== 1 || typeof item.iv !== 'string' || !/^[a-f0-9]{24}$/.test(item.iv) ||
    typeof item.tag !== 'string' || !/^[a-f0-9]{32}$/.test(item.tag) || typeof item.ciphertext !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(item.ciphertext)) return invalid();
  return item as { version: 1; iv: string; tag: string; ciphertext: string };
}
export class Workspace {
  private busy = false;
  private constructor(private data: WorkspaceData, private file: string, private key: Buffer, public deliveryEnabled: boolean) {}
  static async open(config: PrivateConfig): Promise<Workspace> {
    if (!config.auth || !config.workspaceFile) throw new SettingsFailure(503);
    const key = Buffer.from(hkdfSync('sha256', config.auth.sessionSecret, '', 'brevo-miniapp-workspace-v1', 32));
    const stored = await readPrivateJson(config.workspaceFile, envelope, 262144);
    let data: WorkspaceData;
    if (stored) {
      try {
        const decrypt = createDecipheriv('aes-256-gcm', key, Buffer.from(stored.iv, 'hex'));
        decrypt.setAAD(Buffer.from('brevo-miniapp-workspace-v1')); decrypt.setAuthTag(Buffer.from(stored.tag, 'hex'));
        data = validateData(JSON.parse(Buffer.concat([decrypt.update(Buffer.from(stored.ciphertext, 'base64url')), decrypt.final()]).toString('utf8')));
      } catch { throw new Error('Configuració de comptes privada invàlida.'); }
    } else data = { version: 1, revision: 0, accounts: config.accounts.map(defaultAccount),
      alerts: { enabled: false, recipient: '', senderAccountId: '', senderId: null, connectionErrors: true, repeatMinutes: 1440 }, deliveries: [], incidents: {},
      push: { enabled: false, keys: null, devices: [] }, emailBudget: { day: '1970-01-01', attempts: 0 } };
    return new Workspace(validateData(data), config.workspaceFile, key, config.emailDeliveryEnabled === true);
  }
  settings(): WorkspaceSettings {
    return { revision: this.data.revision, accounts: this.data.accounts.map(({ apiKey, ...account }) => ({ ...structuredClone(account), connected: Boolean(apiKey) })),
      alerts: structuredClone(this.data.alerts), deliveries: structuredClone(this.data.deliveries), deliveryEnabled: this.deliveryEnabled,
      pushEnabled: this.data.push.enabled, pushDevices: this.data.push.devices.map(({ id, label, createdAt }) => ({ id, label, createdAt })) };
  }
  pushData() { return structuredClone(this.data.push); }
  accounts(): AccountConfig[] { return this.data.accounts.map(({ id, name, apiKey }) => ({ id, name, apiKey })); }
  account(id: string): PrivateAccount { const account = this.data.accounts.find(account => account.id === id); if (!account) throw new SettingsFailure(404); return structuredClone(account); }
  async edit(revision: number | null, mutate: (draft: WorkspaceData) => Promise<void> | void): Promise<WorkspaceSettings> {
    if (this.busy || revision !== null && revision !== this.data.revision) throw new SettingsFailure(409);
    this.busy = true;
    try {
      const draft = structuredClone(this.data); await mutate(draft); draft.revision++;
      const clean = validateData(draft);
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, iv);
      cipher.setAAD(Buffer.from('brevo-miniapp-workspace-v1'));
      const ciphertext = Buffer.concat([cipher.update(JSON.stringify(clean)), cipher.final()]);
      await writePrivateJson(this.file, { version: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), ciphertext: ciphertext.toString('base64url') }, envelope, 262144);
      this.data = clean; return this.settings();
    } finally { this.busy = false; }
  }
  async add(revision: number, metadata: unknown, apiKey: string, validate: () => Promise<void>) {
    return this.edit(revision, async draft => {
      if (draft.accounts.length >= 25 || draft.accounts.some(account => account.apiKey === apiKey)) throw new SettingsFailure(400);
      await validate(); draft.accounts.push({ ...accountInput(metadata), id: randomUUID(), apiKey });
    });
  }
  async renameLegacy(names: AccountNames) { return this.edit(null, draft => { for (const id of ['1', '2'] as const) { const account = draft.accounts.find(a => a.id === id); if (account) account.name = names[id]; } }); }
  async update(revision: number, id: string, metadata: unknown, credential: string | null, validate: () => Promise<void>) {
    return this.edit(revision, async draft => {
      const account = draft.accounts.find(a => a.id === id); if (!account) throw new SettingsFailure(404);
      if (credential && draft.accounts.some(a => a.id !== id && a.apiKey === credential)) throw new SettingsFailure(400);
      if (credential) await validate(); Object.assign(account, accountInput(metadata));
      if (credential) { account.apiKey = credential; delete draft.incidents[id + ':connection']; delete draft.incidents[id + ':balance']; delete draft.incidents[id + ':forecast']; }
    });
  }
  async remove(revision: number, id: string) { return this.edit(revision, draft => {
    const index = draft.accounts.findIndex(a => a.id === id); if (index < 0) throw new SettingsFailure(404);
    draft.accounts.splice(index, 1);
    if (draft.alerts.senderAccountId === id) { draft.alerts.enabled = false; draft.alerts.senderAccountId = ''; draft.alerts.senderId = null; }
    delete draft.incidents[id + ':connection']; delete draft.incidents[id + ':balance']; delete draft.incidents[id + ':forecast'];
  }); }
}

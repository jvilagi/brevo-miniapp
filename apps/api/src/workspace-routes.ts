import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { BrevoReader } from './brevo.js';
import { activeSenders, type AlertMonitor } from './email-alerts.js';
import { alertInput, exact, pushSubscription, record, SettingsFailure, text, Workspace } from './workspace.js';
import { generatePushKeys } from './push-alerts.js';
import { randomUUID } from 'node:crypto';

type Guard = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
export async function workspaceRoutes(app: FastifyInstance, workspace: Workspace, client: BrevoReader, monitor: AlertMonitor,
  guards: { sameOrigin: Guard; requireSession: Guard; authenticated: (request: FastifyRequest) => boolean; reauthenticate: (request: FastifyRequest, password: string) => Promise<boolean> }) {
  const live = (request: FastifyRequest) => { if (!guards.authenticated(request)) throw new SettingsFailure(401); };
  const revision = (input: unknown): number => { if (!Number.isSafeInteger(input) || (input as number) < 0) throw new SettingsFailure(400); return input as number; };
  const credential = (input: unknown): string => {
    if (typeof input !== 'string' || input.length < 16 || input.length > 512 || /\s/.test(input)) throw new SettingsFailure(400); return input;
  };
  const confirm = async (request: FastifyRequest, input: unknown) => {
    if (typeof input !== 'string' || !input.length || input.length > 256) throw new SettingsFailure(400);
    const password = input;
    const valid = await guards.reauthenticate(request, password); live(request);
    if (!valid) throw Object.assign(new SettingsFailure(400), { publicCode: 'CURRENT_PASSWORD_INCORRECT' });
  };
  const validateKey = async (key: string) => {
    try { const value = record(await client.get(key, '/v3/account')); if (!Array.isArray(value.plan)) throw new Error(); }
    catch { throw new SettingsFailure(422); }
  };
  const protectedPost = { onRequest: [guards.sameOrigin, guards.requireSession], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } };
  app.get('/api/workspace', { onRequest: guards.requireSession }, async () => workspace.settings());
  app.post('/api/workspace/accounts', protectedPost, async request => {
    const body = record(request.body); exact(body, ['revision', 'account', 'credential', 'currentPassword']);
    await confirm(request, body.currentPassword); const key = credential(body.credential);
    return workspace.add(revision(body.revision), body.account, key, async () => { await validateKey(key); live(request); });
  });
  app.post<{ Params: { id: string } }>('/api/workspace/accounts/:id', protectedPost, async request => {
    const body = record(request.body); exact(body, ['revision', 'account', 'credential', 'currentPassword']);
    const key = body.credential === null || body.credential === '' ? null : credential(body.credential);
    if (key) await confirm(request, body.currentPassword);
    return workspace.update(revision(body.revision), request.params.id, body.account, key, async () => { await validateKey(key!); live(request); });
  });
  app.post<{ Params: { id: string } }>('/api/workspace/accounts/:id/disconnect', protectedPost, async request => {
    const body = record(request.body); exact(body, ['revision', 'currentPassword']); await confirm(request, body.currentPassword);
    return workspace.remove(revision(body.revision), request.params.id);
  });
  app.post('/api/workspace/order', protectedPost, async request => {
    const body = record(request.body); exact(body, ['revision', 'ids']);
    if (!Array.isArray(body.ids) || !body.ids.every(id => typeof id === 'string')) throw new SettingsFailure(400);
    const ids = body.ids as string[];
    return workspace.edit(revision(body.revision), draft => {
      if (ids.length !== draft.accounts.length || new Set(ids).size !== ids.length || ids.some(id => !draft.accounts.some(a => a.id === id))) throw new SettingsFailure(400);
      draft.accounts.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    });
  });
  app.get<{ Params: { id: string } }>('/api/workspace/accounts/:id/senders', { onRequest: guards.requireSession, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async request => {
    const account = workspace.account(request.params.id); if (!account.apiKey) throw new SettingsFailure(400);
    const senders = await activeSenders(client, account.apiKey); live(request); return { senders };
  });
  app.post('/api/workspace/alerts', protectedPost, async request => {
    const body = record(request.body); exact(body, ['revision', 'alerts', 'currentPassword']);
    // Un destinatari nou permet enviar informació fora de l'app: exigeix reautenticació.
    await confirm(request, body.currentPassword); const alerts = alertInput(body.alerts);
    if (alerts.enabled) {
      const account = workspace.account(alerts.senderAccountId); if (!account.apiKey) throw new SettingsFailure(400);
      if (!(await activeSenders(client, account.apiKey)).some(sender => sender.id === alerts.senderId)) throw new SettingsFailure(422);
    }
    live(request);
    return workspace.edit(revision(body.revision), draft => { draft.alerts = alerts; draft.incidents = {}; });
  });
  app.post('/api/workspace/alerts/test', { ...protectedPost, config: { rateLimit: { max: 2, timeWindow: '15 minutes' } } }, async request => {
    const body = record(request.body); exact(body, ['revision', 'currentPassword']); await confirm(request, body.currentPassword);
    const status = await monitor.test(revision(body.revision)); return { status, settings: workspace.settings() };
  });
  app.post('/api/workspace/push/key', protectedPost, async request => {
    const body = record(request.body); exact(body, []);
    if (!workspace.pushData().keys) await workspace.edit(null, draft => { draft.push.keys = generatePushKeys(); });
    return { publicKey: workspace.pushData().keys!.publicKey };
  });
  app.post('/api/workspace/push/subscribe', protectedPost, async request => {
    const body = record(request.body); exact(body, ['subscription', 'label']);
    const subscription = pushSubscription(body.subscription), label = text(body.label, 64);
    return workspace.edit(null, draft => {
      if (!draft.push.keys) throw new SettingsFailure(400);
      const existing = draft.push.devices.find(device => device.endpoint === subscription.endpoint);
      if (!existing && draft.push.devices.length >= 20) throw new SettingsFailure(400);
      if (existing) Object.assign(existing, subscription, { label });
      else draft.push.devices.push({ ...subscription, label, id: randomUUID(), createdAt: new Date().toISOString() });
      draft.push.enabled = true;
    });
  });
  app.post('/api/workspace/push/unsubscribe', protectedPost, async request => {
    const body = record(request.body); exact(body, ['endpoint']); const endpoint = text(body.endpoint, 4096);
    return workspace.edit(null, draft => { draft.push.devices = draft.push.devices.filter(device => device.endpoint !== endpoint); if (!draft.push.devices.length) draft.push.enabled = false; });
  });
}

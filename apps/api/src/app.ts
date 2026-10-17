import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountNames, AccountSettings, ApiError, HealthResponse } from '@brevo-miniapp/contracts';
import type { PrivateConfig } from './private-config.js';
import { registerAuth } from './auth.js';
import { BrevoClient, type AccountsService, type BrevoReader } from './brevo.js';
import { savePassword } from './password-store.js';
import { normalizeNames, saveAccountNames } from './account-names.js';
import { SettingsFailure, type Workspace } from './workspace.js';
import { workspaceRoutes } from './workspace-routes.js';
import { AlertMonitor, BrevoAlertSender, type AlertSender } from './email-alerts.js';
import { WebPushSender, type PushSender } from './push-alerts.js';

export interface AppOptions {
  serveWeb?: boolean;
  webRoot?: string;
  privateConfig?: PrivateConfig;
  accountsService?: Pick<AccountsService, 'snapshot'>;
  passwordWriter?: (hash: string) => Promise<void>;
  namesWriter?: (names: AccountNames) => Promise<void>;
  workspace?: Workspace;
  brevoClient?: BrevoReader;
  alertSender?: AlertSender;
  pushSender?: PushSender;
  quotaReader?: () => ReturnType<AccountsService['quotas']>;
}

export async function buildApp(options: AppOptions = {}) {
  // No es registren capçaleres, credencials ni excepcions amb respostes Brevo.
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024, ajv: { customOptions: { removeAdditional: false } } });

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
  });

  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    status: 'ok', service: 'brevo-miniapp',
  }));

  const privateConfig = options.privateConfig ?? {
    auth: null, origin: 'http://127.0.0.1:5174', production: false,
  };
  const passwordFile = options.privateConfig?.passwordFile;
  const { authenticated, sameOrigin, reauthenticate } = await registerAuth(app, privateConfig,
    options.passwordWriter ?? (passwordFile ? (hash) => savePassword(passwordFile, hash) : undefined));
  const requireSession = async (request: import('fastify').FastifyRequest, reply: import('fastify').FastifyReply) => {
    if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
  };
  let names: AccountNames & Record<string, string> = {
    '1': options.privateConfig?.accounts.find((account) => account.id === '1')?.name ?? 'Compte 1',
    '2': options.privateConfig?.accounts.find((account) => account.id === '2')?.name ?? 'Compte 2',
  };
  const workspace = options.workspace;
  if (workspace) {
    const client = options.brevoClient ?? new BrevoClient();
    const monitor = new AlertMonitor(workspace, options.quotaReader ?? (async () => []), options.alertSender ?? new BrevoAlertSender(), Date.now,
      options.pushSender ?? new WebPushSender(privateConfig.origin));
    await workspaceRoutes(app, workspace, client, monitor, { sameOrigin, requireSession, authenticated, reauthenticate });
    app.addHook('onReady', async () => { if (options.quotaReader) monitor.start(); });
    app.addHook('onClose', async () => { monitor.stop(); });
  }
  const namesFile = options.privateConfig?.accountNamesFile;
  const namesWriter = options.namesWriter ?? (namesFile ? (value: AccountNames) => saveAccountNames(namesFile, value) : undefined);
  let savingNames = false;
  app.get('/api/settings/accounts', { onRequest: requireSession }, async () => ({ names: workspace ? {
    '1': workspace.settings().accounts.find(a => a.id === '1')?.name ?? '', '2': workspace.settings().accounts.find(a => a.id === '2')?.name ?? '',
  } : names }));
  app.post<{ Body: AccountSettings }>('/api/settings/accounts', {
    onRequest: [sameOrigin, requireSession], config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    schema: { body: { type: 'object', required: ['names'], additionalProperties: false, properties: {
      names: { type: 'object', required: ['1', '2'], additionalProperties: false, properties: {
        '1': { type: 'string', minLength: 1, maxLength: 100 }, '2': { type: 'string', minLength: 1, maxLength: 100 },
      } },
    } } },
  }, async (request, reply) => {
    let next: AccountNames;
    try { next = normalizeNames(request.body.names); }
    catch { return reply.code(400).send({ error: 'BAD_REQUEST' } satisfies ApiError); }
    if (workspace) { await workspace.renameLegacy(next); return { names: next } satisfies AccountSettings; }
    if (!namesWriter) return reply.code(503).send({ error: 'INTERNAL_ERROR' } satisfies ApiError);
    if (savingNames) return reply.code(429).send({ error: 'RATE_LIMITED' } satisfies ApiError);
    savingNames = true;
    try { await namesWriter(next); names = next; return { names } satisfies AccountSettings; }
    finally { savingNames = false; }
  });
  app.all('/api/accounts', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    if (request.method !== 'GET') return reply.code(404).send({ error: 'NOT_FOUND' } satisfies ApiError);
    if (!options.accountsService) return reply.code(500).send({ error: 'INTERNAL_ERROR' } satisfies ApiError);
    const signature = workspace ? JSON.stringify(workspace.accounts()) : '';
    const snapshot = await options.accountsService.snapshot();
    if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    if (workspace && signature !== JSON.stringify(workspace.accounts())) return reply.code(409).send({ error: 'SETTINGS_CONFLICT' });
    if (workspace) {
      const current = workspace.settings().accounts;
      return { ...snapshot, accounts: current.flatMap(metadata => {
        const account = snapshot.accounts.find(account => account.id === metadata.id);
        return account ? [{ ...account, name: metadata.name, appearance: metadata.appearance, reference: metadata.reference }] : [];
      }) };
    }
    return { ...snapshot, accounts: snapshot.accounts.map((account) => ({ ...account, name: names[account.id] ?? account.name })) };
  });

  if (options.serveWeb) {
    const webRoot = options.webRoot ?? fileURLToPath(new URL('../../web/dist/', import.meta.url));
    if (!existsSync(join(webRoot, 'index.html'))) {
      throw new Error('Falta la compilació del frontend. Executa npm run build.');
    }
    await app.register(fastifyStatic, { root: webRoot, dotfiles: 'ignore', cacheControl: false });
    app.addHook('onSend', async (request, reply, payload) => {
      if (request.url.split('?')[0]?.startsWith('/assets/') && reply.statusCode === 200) {
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      }
      reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
      return payload;
    });
  }

  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({ error: 'NOT_FOUND' } satisfies ApiError));
  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof SettingsFailure) return reply.code(error.status).send({ error: 'publicCode' in error ? error.publicCode :
      error.status === 401 ? 'UNAUTHORIZED' : error.status === 409 ? 'SETTINGS_CONFLICT' : error.status === 422 ? 'BREVO_VALIDATION_FAILED' : error.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST' });
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
    if (statusCode === 400) return reply.code(400).send({ error: 'BAD_REQUEST' } satisfies ApiError);
    if (statusCode === 413) return reply.code(413).send({ error: 'PAYLOAD_TOO_LARGE' } satisfies ApiError);
    if (statusCode === 429) return reply.code(429).send({ error: 'RATE_LIMITED' } satisfies ApiError);
    if (statusCode === 403 || statusCode === 404) return reply.code(404).send({ error: 'NOT_FOUND' } satisfies ApiError);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' } satisfies ApiError);
  });
  return app;
}

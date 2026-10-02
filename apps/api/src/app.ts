import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiError, HealthResponse } from '@brevo-miniapp/contracts';
import type { PrivateConfig } from './private-config.js';
import { registerAuth } from './auth.js';
import type { AccountsService } from './brevo.js';

export interface AppOptions {
  serveWeb?: boolean;
  webRoot?: string;
  privateConfig?: PrivateConfig;
  accountsService?: Pick<AccountsService, 'snapshot'>;
}

export async function buildApp(options: AppOptions = {}) {
  // No es registren capçaleres, credencials ni excepcions amb respostes Brevo.
  const app = Fastify({ logger: false, bodyLimit: 16 * 1024 });

  app.addHook('onRequest', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
  });

  app.get<{ Reply: HealthResponse }>('/api/health', async () => ({
    status: 'ok', service: 'brevo-miniapp',
  }));

  const authenticated = await registerAuth(app, options.privateConfig ?? {
    auth: null, origin: 'http://127.0.0.1:5174', production: false,
  });
  app.all('/api/accounts', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    if (request.method !== 'GET') return reply.code(404).send({ error: 'NOT_FOUND' } satisfies ApiError);
    if (!options.accountsService) return reply.code(500).send({ error: 'INTERNAL_ERROR' } satisfies ApiError);
    return options.accountsService.snapshot();
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
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : null;
    if (statusCode === 400) return reply.code(400).send({ error: 'BAD_REQUEST' } satisfies ApiError);
    if (statusCode === 413) return reply.code(413).send({ error: 'PAYLOAD_TOO_LARGE' } satisfies ApiError);
    if (statusCode === 429) return reply.code(429).send({ error: 'RATE_LIMITED' } satisfies ApiError);
    if (statusCode === 403 || statusCode === 404) return reply.code(404).send({ error: 'NOT_FOUND' } satisfies ApiError);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' } satisfies ApiError);
  });
  return app;
}

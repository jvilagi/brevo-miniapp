import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ApiError, SessionResponse } from '@brevo-miniapp/contracts';
import type { AuthConfig } from './private-config.js';
import { hashPassword, verifyPassword } from './password.js';

export async function registerAuth(app: FastifyInstance, config: { auth: AuthConfig | null; origin: string; production: boolean },
  passwordWriter?: (hash: string) => Promise<void>) {
  await app.register(cookie, config.auth ? { secret: config.auth.sessionSecret } : {});
  await app.register(rateLimit, { global: false, max: 60, timeWindow: '1 minute' });
  const name = config.production ? '__Host-brevo-session' : 'brevo-session';
  const maxAge = 7 * 24 * 60 * 60;
  const settings = { path: '/', httpOnly: true, secure: config.production, sameSite: 'strict' as const };
  const sessions = new Map<string, number>();
  const digest = (token: string) => createHash('sha256').update(token).digest('hex');
  function sessionId(request: FastifyRequest) {
    const value = request.cookies[name];
    if (!config.auth || !value) return null;
    const unsigned = request.unsignCookie(value);
    return unsigned.valid && unsigned.value ? digest(unsigned.value) : null;
  }
  function authenticated(request: FastifyRequest): boolean {
    const id = sessionId(request);
    if (!id) return false;
    const expires = sessions.get(id);
    if (!expires || expires <= Date.now()) { sessions.delete(id); return false; }
    return true;
  }
  app.addHook('onClose', async () => { sessions.clear(); });
  app.get<{ Reply: SessionResponse }>('/api/auth/session', async (request) => ({
    authenticated: authenticated(request), configured: config.auth !== null,
  }));
  // Origin i capçalera no simple: impedeixen formularis i peticions de tercers.
  const sameOrigin = async (request: FastifyRequest, reply: import('fastify').FastifyReply) => {
    if (request.headers.origin !== config.origin || request.headers['x-app-request'] !== '1' || request.headers['sec-fetch-site'] === 'cross-site') {
      return reply.code(403).send({ error: 'FORBIDDEN' } satisfies ApiError);
    }
  };
  let concurrentChecks = 0;
  let windowStart = Date.now();
  let attempts = 0;
  let passwordHash = config.auth?.passwordHash;
  let changing = false;
  let revision = 0;
  app.post<{ Body: { password: string } }>('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }, onRequest: sameOrigin,
    schema: { body: { type: 'object', required: ['password'], additionalProperties: false,
      properties: { password: { type: 'string', minLength: 1, maxLength: 256 } } } },
  }, async (request, reply) => {
    if (!config.auth) return reply.code(503).send({ error: 'AUTH_NOT_CONFIGURED' } satisfies ApiError);
    if (Date.now() - windowStart >= 15 * 60_000) { windowStart = Date.now(); attempts = 0; }
    if (++attempts > 30 || concurrentChecks >= 2 || changing) return reply.code(429).send({ error: 'RATE_LIMITED' } satisfies ApiError);
    concurrentChecks++;
    let valid;
    const checkedRevision = revision;
    try { valid = await verifyPassword(request.body.password, passwordHash!); }
    finally { concurrentChecks--; }
    if (checkedRevision !== revision || changing) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    if (!valid) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    const previous = sessionId(request);
    if (previous) sessions.delete(previous);
    for (const [id, expires] of sessions) if (expires <= Date.now()) sessions.delete(id);
    if (sessions.size >= 200) sessions.delete(sessions.keys().next().value!);
    const token = randomBytes(32).toString('base64url');
    sessions.set(digest(token), Date.now() + maxAge * 1000);
    reply.setCookie(name, token, { ...settings, signed: true, maxAge });
    return { authenticated: true, configured: true } satisfies SessionResponse;
  });
  app.post('/api/auth/logout', { onRequest: sameOrigin }, async (request, reply) => {
    const id = sessionId(request);
    if (id) sessions.delete(id);
    reply.clearCookie(name, settings);
    return { authenticated: false, configured: config.auth !== null } satisfies SessionResponse;
  });
  app.post<{ Body: { currentPassword: string; newPassword: string; confirmation: string } }>('/api/auth/password', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    onRequest: [sameOrigin, async (request, reply) => {
      if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
    }],
    schema: { body: { type: 'object', required: ['currentPassword', 'newPassword', 'confirmation'], additionalProperties: false,
      properties: {
        currentPassword: { type: 'string', minLength: 1, maxLength: 256 },
        newPassword: { type: 'string', minLength: 12, maxLength: 256 },
        confirmation: { type: 'string', minLength: 12, maxLength: 256 },
      } } },
  }, async (request, reply) => {
    if (!passwordWriter) return reply.code(503).send({ error: 'PASSWORD_CHANGE_UNAVAILABLE' } satisfies ApiError);
    if (request.body.newPassword !== request.body.confirmation || request.body.newPassword === request.body.currentPassword) {
      return reply.code(400).send({ error: 'BAD_REQUEST' } satisfies ApiError);
    }
    if (Date.now() - windowStart >= 15 * 60_000) { windowStart = Date.now(); attempts = 0; }
    if (++attempts > 30 || concurrentChecks >= 2 || changing) return reply.code(429).send({ error: 'RATE_LIMITED' } satisfies ApiError);
    changing = true; concurrentChecks++;
    try {
      if (!await verifyPassword(request.body.currentPassword, passwordHash!)) {
        return reply.code(400).send({ error: 'CURRENT_PASSWORD_INCORRECT' } satisfies ApiError);
      }
      if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
      const next = await hashPassword(request.body.newPassword);
      if (!authenticated(request)) return reply.code(401).send({ error: 'UNAUTHORIZED' } satisfies ApiError);
      await passwordWriter(next);
      passwordHash = next; revision++; sessions.clear();
      reply.clearCookie(name, settings);
      return { authenticated: false, configured: true } satisfies SessionResponse;
    } finally { changing = false; concurrentChecks--; }
  });
  return authenticated;
}

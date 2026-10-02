export interface Config {
  host: string;
  port: number;
  production: boolean;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT ha de ser un enter entre 1 i 65535.');
  }
  const host = env['HOST'] ?? '127.0.0.1';
  const production = env['NODE_ENV'] === 'production';
  if (!production && !['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('El mode local només pot escoltar a localhost.');
  }
  return {
    host,
    port,
    production,
  };
}

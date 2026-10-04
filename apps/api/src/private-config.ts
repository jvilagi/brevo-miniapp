import { lstat, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { validPasswordHash } from './password.js';
import { readStoredPassword } from './password-store.js';
import { readAccountNames } from './account-names.js';

export interface AuthConfig { passwordHash: string; sessionSecret: string }
export interface AccountConfig { id: '1' | '2'; name: string; apiKey: string | null }
export interface PrivateConfig {
  auth: AuthConfig | null;
  accounts: AccountConfig[];
  origin: string;
  timezone: string;
  production: boolean;
  passwordFile?: string;
  accountNamesFile?: string;
}

export async function readPrivateEnv(path: string, optional = false): Promise<NodeJS.ProcessEnv> {
  try {
    if (!isAbsolute(path)) throw new Error();
    const checkout = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
    const resolved = await realpath(path);
    const inside = relative(checkout, resolved);
    if (!inside || (!inside.startsWith('../') && !isAbsolute(inside))) throw new Error();
    const info = await lstat(path);
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error();
    return parseEnv(await readFile(path, 'utf8'));
  } catch (error) {
    if (optional && error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return {};
    throw new Error('Configuració privada invàlida: comprova ubicació i permisos.');
  }
}

export async function loadPrivateConfig(env: NodeJS.ProcessEnv = process.env): Promise<PrivateConfig> {
  const directory = join(homedir(), '.config', 'brevo-miniapp');
  const accountsEnv = await readPrivateEnv(env['BREVO_SECRETS_FILE'] ?? join(directory, 'accounts.env'), !env['BREVO_SECRETS_FILE']);
  const authFile = env['AUTH_SECRETS_FILE'] ?? join(directory, 'auth.env');
  const authEnv = await readPrivateEnv(authFile, !env['AUTH_SECRETS_FILE']);
  let passwordHash = env['APP_PASSWORD_HASH'] ?? authEnv['APP_PASSWORD_HASH'];
  const sessionSecret = env['SESSION_SECRET'] ?? authEnv['SESSION_SECRET'];
  if ((passwordHash || sessionSecret) && (!passwordHash || !validPasswordHash(passwordHash) || !sessionSecret || sessionSecret.length < 43)) {
    throw new Error('Configuració d’accés privat incompleta o invàlida.');
  }
  const passwordFile = env['AUTH_PASSWORD_FILE'] ?? join(dirname(authFile), 'access', 'password.json');
  if (passwordHash) passwordHash = await readStoredPassword(passwordFile) ?? passwordHash;
  const accountNamesFile = env['ACCOUNT_NAMES_FILE'] ?? join(dirname(passwordFile), 'account-names.json');
  const names = await readAccountNames(accountNamesFile);
  const production = env['NODE_ENV'] === 'production';
  if (production && !env['PUBLIC_ORIGIN']) throw new Error('Cal definir PUBLIC_ORIGIN amb el teu origen HTTPS.');
  const origin = env['PUBLIC_ORIGIN'] ?? 'http://127.0.0.1:5174';
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password || (production ? url.protocol !== 'https:' :
    !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))))) {
    throw new Error('PUBLIC_ORIGIN ha de ser un origen segur explícit.');
  }
  if (production && !passwordHash) throw new Error('Cal configurar l’accés privat abans de producció.');
  // Fus actual dels dos comptes verificat a Brevo; no suposar canvis automàtics d'horari.
  const timezone = env['BREVO_TIMEZONE'] ?? 'Etc/GMT-2';
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  return {
    auth: passwordHash && sessionSecret ? { passwordHash, sessionSecret } : null,
    accounts: (['1', '2'] as const).map((id) => ({ id,
      name: names?.[id] ?? (env[`BREVO_ACCOUNT_${id}_NAME`] ?? `Compte ${id}`).slice(0, 100),
      apiKey: env[`BREVO_ACCOUNT_${id}_API_KEY`] ?? accountsEnv[`BREVO_ACCOUNT_${id}_API_KEY`] ?? null,
    })), origin, timezone, production, passwordFile, accountNamesFile,
  };
}

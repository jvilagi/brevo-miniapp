import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, parameters, (error, result) =>
    error ? reject(error) : resolve(result)));
}

export function validPasswordHash(hash: string): boolean {
  return /^scrypt\$32768\$8\$3\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(hash);
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error('Contrasenya no vàlida.');
  const salt = randomBytes(16);
  const result = await derive(password, salt);
  return `scrypt$32768$8$3$${salt.toString('base64url')}$${result.toString('base64url')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!validPasswordHash(hash) || password.length > 256) return false;
  const parts = hash.split('$');
  const actual = await derive(password, Buffer.from(parts[4]!, 'base64url'));
  return timingSafeEqual(actual, Buffer.from(parts[5]!, 'base64url'));
}

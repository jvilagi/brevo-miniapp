import { validPasswordHash } from './password.js';
import { readPrivateJson, writePrivateJson } from './private-json.js';

function validate(value: unknown): { passwordHash: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 ||
    !('passwordHash' in value) || typeof value.passwordHash !== 'string' || !validPasswordHash(value.passwordHash)) throw new Error();
  return { passwordHash: value.passwordHash };
}
export async function readStoredPassword(file: string): Promise<string | null> {
  return (await readPrivateJson(file, validate))?.passwordHash ?? null;
}
export async function savePassword(file: string, passwordHash: string): Promise<void> {
  await writePrivateJson(file, { passwordHash }, validate);
}

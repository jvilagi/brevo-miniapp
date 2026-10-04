import type { AccountNames } from '@brevo-miniapp/contracts';
import { readPrivateJson, writePrivateJson } from './private-json.js';

export function normalizeNames(value: unknown): AccountNames {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 ||
    !('1' in value) || !('2' in value)) throw new Error('Noms no vàlids.');
  const name = (input: unknown) => {
    if (typeof input !== 'string' || !input.trim() || input.length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(input)) throw new Error('Nom no vàlid.');
    return input.trim();
  };
  return { '1': name(value['1']), '2': name(value['2']) };
}
export const readAccountNames = (file: string) => readPrivateJson(file, normalizeNames);
export const saveAccountNames = (file: string, names: AccountNames) => writePrivateJson(file, names, normalizeNames);

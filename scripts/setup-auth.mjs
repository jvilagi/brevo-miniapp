import { mkdir, open, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../apps/api/dist/password.js';

// La línia es llegeix sense eco, sense historial persistent i sense arguments visibles.
async function hidden(prompt) {
  process.stdout.write(prompt);
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const input = createInterface({ input: process.stdin, output: muted, terminal: true, historySize: 0 });
  return new Promise((resolve, reject) => {
    input.once('line', (value) => { input.close(); process.stdout.write('\n'); resolve(value); });
    input.once('SIGINT', () => { input.close(); reject(new Error('Cancel·lat.')); });
  });
}

try {
  if (!process.stdin.isTTY) throw new Error('Executa aquesta comanda en un terminal interactiu.');
  const directory = join(homedir(), '.config', 'brevo-miniapp');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || (info.mode & 0o077) || info.uid !== process.getuid()) throw new Error('Revisa els permisos del directori privat (0700).');
  const password = await hidden('Contrasenya nova (mínim 12 caràcters; entrada oculta): ');
  const confirmation = await hidden('Repeteix-la: ');
  if (password !== confirmation) throw new Error('Les contrasenyes no coincideixen.');
  const hash = await hashPassword(password);
  const file = await open(join(directory, 'auth.env'), 'wx', 0o600);
  try { await file.writeFile(`APP_PASSWORD_HASH='${hash}'\nSESSION_SECRET=${randomBytes(32).toString('base64url')}\n`); }
  finally { await file.close(); }
  console.info('Accés configurat al fitxer privat auth.env. Reinicia npm run dev.');
} catch (error) {
  console.error(error?.code === 'EEXIST' ? 'auth.env ja existeix. No s’ha sobreescrit.' :
    ['Cancel·lat.', 'Executa aquesta comanda en un terminal interactiu.', 'Revisa els permisos del directori privat (0700).', 'Les contrasenyes no coincideixen.', 'Contrasenya no vàlida.'].includes(error?.message) ? error.message : 'No s’ha pogut configurar l’accés privat.');
  process.exitCode = 1;
}

import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const failure = () => new Error('No s’ha pogut accedir a la configuració privada.');
const absent = (error: unknown) => error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';
async function location(file: string) {
  if (!isAbsolute(file)) throw failure();
  const checkout = await realpath(fileURLToPath(new URL('../../../', import.meta.url)));
  let parent = dirname(file);
  while (true) {
    try {
      const resolved = await realpath(parent);
      const target = join(resolved, relative(parent, file));
      const inside = relative(checkout, target);
      if (!inside || (!inside.startsWith('../') && !isAbsolute(inside))) throw failure();
      return;
    } catch (error) {
      if (!absent(error) || parent === dirname(parent)) throw failure();
      parent = dirname(parent);
    }
  }
}
async function privateDirectory(file: string) {
  const info = await lstat(dirname(file));
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077)) throw failure();
}
export async function readPrivateJson<T>(file: string, validate: (value: unknown) => T): Promise<T | null> {
  try {
    await location(file);
    try { await privateDirectory(file); } catch (error) { if (absent(error)) return null; throw error; }
    let handle;
    try { handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (absent(error)) return null; throw error; }
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.uid !== process.getuid?.() || (info.mode & 0o077) || info.size > 1024) throw failure();
      return validate(JSON.parse(await handle.readFile('utf8')));
    } finally { await handle.close(); }
  } catch { throw failure(); }
}
export async function writePrivateJson<T>(file: string, value: T, validate: (value: unknown) => T): Promise<void> {
  let temporary: string | null = null;
  try {
    const content = JSON.stringify(validate(value)) + '\n';
    if (Buffer.byteLength(content) > 1024) throw failure();
    await location(file);
    try { await mkdir(dirname(file), { mode: 0o700 }); }
    catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error; }
    await privateDirectory(file);
    await readPrivateJson(file, validate);
    temporary = join(dirname(file), `.private-${randomBytes(16).toString('hex')}.tmp`);
    const handle = await open(temporary, 'wx', 0o600);
    try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, file); temporary = null;
    // El rename ja està compromès: no desalinear memòria i disc si fsync no és admès.
    try {
      const directory = await open(dirname(file), constants.O_RDONLY);
      try { await directory.sync(); } finally { await directory.close(); }
    } catch { /* Alguns sistemes no admeten fsync de directoris. */ }
  } catch { throw failure(); }
  finally { if (temporary) await unlink(temporary).catch(() => {}); }
}

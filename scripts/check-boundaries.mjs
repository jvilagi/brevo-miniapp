import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
async function checkDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await checkDirectory(path);
    else if (/\.(?:js|ts|tsx|html|json|webmanifest|svg|css)$/.test(entry.name)) {
      const content = await readFile(path, 'utf8');
      assert(!/xkeysib-|BREVO_ACCOUNT_\d_API_KEY|APP_PASSWORD_HASH|SESSION_SECRET|api\.brevo\.com|apps\/api\/src|brevo-build-secret-canary/.test(content), `Límit de seguretat infringit: ${path}`);
    }
  }
}
await checkDirectory(join(root, 'apps/web/src'));
await checkDirectory(join(root, 'apps/web/public'));
await checkDirectory(join(root, 'apps/web/pwa'));
await checkDirectory(join(root, 'apps/web/dist'));
await checkDirectory(join(root, 'packages/contracts/src'));
console.info('Separació del frontend, contractes i secrets: correcta.');

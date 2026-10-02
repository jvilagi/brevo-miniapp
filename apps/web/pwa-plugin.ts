import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function staticPwa(): Plugin {
  let directory = '';
  return {
    name: 'brevo-static-pwa', apply: 'build',
    configResolved(config) { directory = resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const assets = (await readdir(join(directory, 'assets'))).filter((name) => /\.(js|css)$/.test(name));
      const files = ['/index.html', '/manifest.webmanifest', '/brand/miniapp-mark.svg', '/icons/app-icon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
        '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', ...assets.map((name) => `/assets/${name}`)].sort();
      const hash = createHash('sha256');
      for (const path of files) { hash.update(path); hash.update(await readFile(join(directory, path))); }
      const name = `brevo-static-${hash.digest('hex').slice(0, 20)}`;
      const template = await readFile(fileURLToPath(new URL('./pwa/service-worker.js', import.meta.url)), 'utf8');
      await writeFile(join(directory, 'sw.js'), template.replace('__CACHE_NAME__', name).replace('__STATIC_FILES__', JSON.stringify(files)));
    },
  };
}

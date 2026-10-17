import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Dependencies embedded in the browser bundle; retain their full notices.
const root = fileURLToPath(new URL('../', import.meta.url));
let output = '# Third-party notices\n\n';
output += 'Original project code uses PolyForm Noncommercial 1.0.0. Dependencies retain their own licenses.\n\n';
output += 'This file preserves the full license notices of React, React DOM, and Scheduler embedded in the browser bundle. Backend dependencies installed by npm retain license files in node_modules; the Docker runtime copies that directory intact. Build tools and optional platform binaries retain the licenses recorded in package-lock.json and their packages. No third-party code is relicensed by the project. Node.js and container base images also retain their upstream licenses.\n\n';
for (const name of ['react', 'react-dom', 'scheduler']) {
  const directory = join(root, 'node_modules', name);
  const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  if (metadata.license !== 'MIT') throw new Error(`Review changed license: ${name}`);
  const license = await readFile(join(directory, 'LICENSE'), 'utf8');
  output += `## ${name} ${metadata.version}\n\nSource: https://github.com/facebook/react\n\nLicense: MIT\n\n\`\`\`text\n${license.trimEnd()}\n\`\`\`\n\n`;
}
const pushDirectory = join(root, 'node_modules', 'web-push');
const pushMetadata = JSON.parse(await readFile(join(pushDirectory, 'package.json'), 'utf8'));
if (pushMetadata.license !== 'MPL-2.0') throw new Error('Review changed license: web-push');
output += `## web-push ${pushMetadata.version} (backend)\n\nSource: https://github.com/web-push-libs/web-push/tree/v${pushMetadata.version}\n\nLicense: [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/). This dependency is not covered by the project’s PolyForm license. Its unmodified Source Code Form is included at node_modules/web-push/src in the Docker runtime and remains available under MPL-2.0 from the upstream release above. The upstream notice is preserved below and in node_modules/web-push/LICENSE.\n\n\`\`\`text\n${(await readFile(join(pushDirectory, 'LICENSE'), 'utf8')).trimEnd()}\n\`\`\`\n`;
await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), output);
console.log('Third-party browser and web-push notices generated from installed packages.');

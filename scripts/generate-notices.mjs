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
await writeFile(join(root, 'THIRD_PARTY_NOTICES.md'), output);
console.log('Third-party browser notices generated from installed packages.');

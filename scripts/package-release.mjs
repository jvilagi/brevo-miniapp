import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'test-results', 'deploy');
await mkdir(output, { recursive: true });
const archive = join(output, 'release.tgz');
// Llista explícita: mai .git, sources, secrets ni configuració privada.
execFileSync('tar', ['-czf', archive, '--exclude=node_modules', '--exclude=dist', '--exclude=.env', '--exclude=.env.*',
  '--exclude=accounts.env', '--exclude=auth.env', '--exclude=runtime.env', '--exclude=compose.env',
  '--exclude=password.json', '--exclude=access', '--exclude=.password-*.tmp',
  '--exclude=private', '--exclude=secrets', '--exclude=.secrets', '--exclude=*.p12',
  '--exclude=*.pem', '--exclude=*.key', '--exclude=.DS_Store', '--exclude=test-results', '--exclude=*.log',
  'package.json', 'package-lock.json', 'tsconfig.base.json', '.dockerignore', 'AGENTS.md', 'README.md', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'CONTRIBUTING.md', 'apps', 'packages', 'deploy', 'scripts', 'docs'],
  { cwd: root, stdio: 'inherit', env: { ...process.env, LC_ALL: 'C' } });
const sha256 = createHash('sha256').update(await readFile(archive)).digest('hex');
const release = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z-${sha256.slice(0, 8)}`.toLowerCase();
const metadata = { release, sha256, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  includesWorkingTree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0 };
await writeFile(join(output, 'release.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(join(output, 'compose.env'), `BREVO_PRIVATE_DIR=${process.env['BREVO_PRIVATE_DIR'] ?? '/opt/docker/projects/brevo-miniapp/private'}\nBREVO_RELEASE=${release}\n`, { mode: 0o600 });
console.log(JSON.stringify(metadata));

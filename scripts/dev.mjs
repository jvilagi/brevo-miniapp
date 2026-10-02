import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Només el backend rep configuració privada.
const webEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/BREVO|PASSWORD|SESSION_SECRET|AUTH_SECRETS|^VITE_|^PUBLIC_WEB_/i.test(name)));
const children = [
  spawn(process.execPath, ['--import', 'tsx', '--watch', 'src/server.ts'], {
    cwd: fileURLToPath(new URL('../apps/api/', import.meta.url)),
    env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3000' }, stdio: 'inherit',
  }),
  spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))], {
    cwd: fileURLToPath(new URL('../apps/web/', import.meta.url)),
    env: webEnv, stdio: 'inherit',
  }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
for (const child of children) {
  child.once('error', () => stop(1));
  child.once('exit', (code) => stop(code ?? 1));
}

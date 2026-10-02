import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { loadPrivateConfig } from './private-config.js';
import { AccountsService } from './brevo.js';

try {
  const config = readConfig();
  const privateConfig = await loadPrivateConfig();
  const app = await buildApp({ serveWeb: config.production, privateConfig,
    accountsService: new AccountsService(privateConfig.accounts, privateConfig.timezone) });
  const address = await app.listen({ host: config.host, port: config.port });
  console.info(`Brevo MiniApp: ${address}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close().then(() => { process.exitCode = 0; }).catch(() => { process.exitCode = 1; });
    });
  }
} catch {
  console.error('No s’ha pogut iniciar Brevo MiniApp. Revisa el port, la configuració i la compilació.');
  process.exitCode = 1;
}

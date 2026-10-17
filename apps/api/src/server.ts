import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { loadPrivateConfig } from './private-config.js';
import { AccountsService, BrevoClient } from './brevo.js';
import { Workspace } from './workspace.js';

try {
  const config = readConfig();
  const privateConfig = await loadPrivateConfig();
  const workspace = privateConfig.auth ? await Workspace.open(privateConfig) : undefined;
  const client = new BrevoClient();
  const service = new AccountsService(workspace ? () => workspace.accounts() : privateConfig.accounts, privateConfig.timezone, client);
  const app = await buildApp({ serveWeb: config.production, privateConfig,
    accountsService: service, ...(workspace ? { workspace, brevoClient: client, quotaReader: () => service.quotas() } : {}) });
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

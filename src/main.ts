import {
  createBodyParserMiddleware,
  createCorsMiddleware,
  createPurpleCheetah,
  updateLogger,
} from '@becomes/purple-cheetah';
import { createFSDB } from '@becomes/purple-cheetah-mod-fsdb';
import { ShimConfig } from './config';
import {
  HealthController,
  PluginController,
  UserController,
} from './controllers';
import { SecurityMiddleware } from './middleware/security';
import { createInstanceOrchestration } from './orchestration';
import {
  createCloudConnectionService,
  createLicenseService,
  createSecurityService,
} from './services';
import { createCmsService } from './services/cms';

async function main() {
  if (ShimConfig.local) {
    // eslint-disable-next-line no-console
    console.warn('DEV', {
      message:
        'Shim is started with LOCAL DEVELOPMENT FLAG.' +
        ' Please do not forget to remove this flag in production.',
    });
  }
  updateLogger({ output: 'storage/logs' });
  createPurpleCheetah({
    port: process.env.PORT ? parseInt(process.env.PORT) : 1282,
    controllers: [UserController, PluginController, HealthController],
    middleware: [
      createBodyParserMiddleware(),
      createCorsMiddleware(),
      SecurityMiddleware,
    ],
    modules: [
      createFSDB({
        output: 'storage/shim-db',
      }),
      createCloudConnectionService(),
      createSecurityService(),
      createCmsService(),
      createLicenseService(),
      createInstanceOrchestration(),
    ],
  });
}
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

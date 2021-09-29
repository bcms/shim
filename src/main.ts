import {
  createBodyParserMiddleware,
  createCorsMiddleware,
  createPurpleCheetah,
  createRequestLoggerMiddleware,
  updateLogger,
} from '@becomes/purple-cheetah';
import { ShimConfig } from './config';
import {
  HealthController,
  PluginController,
  UserController,
} from './controllers';
import { SecurityMiddleware } from './middleware';
import { createInstanceOrchestration } from './orchestration';
import { DefaultInstanceProxy } from './proxy';
import {
  createCloudConnectionService,
  createLicenseService,
  createSecurityService,
  Service,
} from './services';

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
      createCorsMiddleware(),
      DefaultInstanceProxy,
      createBodyParserMiddleware(),
      createRequestLoggerMiddleware(),
      SecurityMiddleware,
    ],
    modules: [
      createLicenseService(),
      createSecurityService(),
      createCloudConnectionService(),

      createInstanceOrchestration(),
    ],
  });
}
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

import { createPurpleCheetah } from '@becomes/purple-cheetah';
import { ShimConfig } from './config';
import { PluginController, UserController } from './controllers';
import { ShimInstanceMiddleware } from './middleware';
import {
  createConnectionService,
  createSecurityService,
  createShimInstanceService,
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
  createPurpleCheetah({
    port: process.env.PORT ? parseInt(process.env.PORT) : 1282,
    controllers: [UserController, PluginController],
    middleware: [ShimInstanceMiddleware],
    onReady() {
      ShimConfig.instance = createShimInstanceService();
      ShimConfig.security = createSecurityService();
      ShimConfig.connection = createConnectionService();
      ShimConfig.security.init();
    },
  });
}
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

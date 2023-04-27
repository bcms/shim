import { createPurpleCheetah } from '@becomes/purple-cheetah';
import { ShimConfig } from './config';
import { initializeServices } from './services';

createPurpleCheetah({
  port: ShimConfig.port,
  logger: {
    saveToFile: {
      interval: 5000,
      output: 'storage/logs',
    },
  },
  modules: [initializeServices()],
  onReady() {
    if (ShimConfig.local) {
      // eslint-disable-next-line no-console
      console.warn('DEV', {
        message:
          'Shim is started with LOCAL DEVELOPMENT FLAG.' +
          ' Please do not forget to remove this flag in production.',
      });
    }
  },
});

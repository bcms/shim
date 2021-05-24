import { Logger } from '@becomes/purple-cheetah';
import { App } from './app';
import { SecurityService } from './services';

const logger = new Logger('BCMSShim');
let app: App;

async function initialize() {
  if (process.env.BCMS_LOCAL === 'true') {
    logger.warn('DEV', {
      message:
        'Shim is started with LOCAL DEVELOPMENT FLAG.' +
        ' Please do not forget to remove this flag in production.',
    });
  }
  await SecurityService.init();
  logger.info('initialize', 'Done');
}
initialize()
  .then(() => {
    app = new App();
    app.listen().catch((error) => {
      console.error(error);
      logger.error('initialize', error);
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error(error);
    logger.error('initialize', error);
    process.exit(1);
  });

export const Application = app;

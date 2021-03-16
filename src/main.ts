import { Logger } from '@becomes/purple-cheetah';
import { App } from './app';
import { SecurityService } from './services';

const logger = new Logger('BCMSShim');
let app: App;

async function initialize() {
  await SecurityService.init();
  logger.info('initialize', 'Done');
}
initialize()
  .then(() => {
    app = new App();
    app.listen();
  })
  .catch((error) => {
    console.error(error);
    logger.error('initialize', error);
    process.exit(1);
  });

export const Application = app;

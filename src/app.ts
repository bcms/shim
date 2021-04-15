import {
  Application,
  BodyParserMiddleware,
  PurpleCheetah,
  RequestLoggerMiddleware,
} from '@becomes/purple-cheetah';
import { ShimInstanceMiddleware } from './middleware';
import { ShimInstanceUserController } from './controllers';

@Application({
  port: process.env.PORT ? parseInt(process.env.PORT) : 1282,
  controllers: [new ShimInstanceUserController()],
  middleware: [
    new BodyParserMiddleware(),
    new ShimInstanceMiddleware(),
    new RequestLoggerMiddleware(),
  ],
})
export class App extends PurpleCheetah {}

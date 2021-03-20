import {
  Application,
  BodyParserMiddleware,
  PurpleCheetah,
} from '@becomes/purple-cheetah';
import { ShimInstanceMiddleware } from './middleware';

@Application({
  port: process.env.PORT ? parseInt(process.env.PORT) : 2070,
  controllers: [],
  middleware: [
    new BodyParserMiddleware(),
    new ShimInstanceMiddleware(),
  ],
})
export class App extends PurpleCheetah {}

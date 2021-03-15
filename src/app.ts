import { Application, PurpleCheetah } from '@becomes/purple-cheetah';

@Application({
  port: process.env.PORT ? parseInt(process.env.PORT) : 2070,
  controllers: [],
  middleware: [],
})
export class App extends PurpleCheetah {}

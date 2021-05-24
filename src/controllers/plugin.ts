import {
  Controller,
  ControllerPrototype,
  HttpErrorFactory,
  Logger,
  Post,
} from '@becomes/purple-cheetah';
import type { Router } from 'express';

@Controller('/shim/instance/plugin')
export class ShimInstancePluginController implements ControllerPrototype {
  router: Router;
  logger: Logger;
  name: string;
  baseUri: string;
  initRouter: () => void;

  @Post('/verify/:name')
  async verifyPluginName(): Promise<{
    ok: boolean;
  }> {
    const error = HttpErrorFactory.instance(
      'verifyPluginName',
      this.logger,
    );
    if (process.env.BCMS_LOCAL) {
      return {
        ok: true,
      };
    }
    /**
     * TODO: Ask the Cloud
     *
     * Get the local plugin license. If license does not exist,
     * return false, other vise, ask the Cloud and pass response.
     */
  }
}

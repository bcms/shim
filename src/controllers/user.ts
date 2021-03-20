import type { Request, Router } from 'express';
import type {
  ControllerPrototype,
  Logger,
} from '@becomes/purple-cheetah';
import {
  Controller,
  HttpErrorFactory,
  Post,
} from '@becomes/purple-cheetah';
import { ConnectionService } from '../services';
import type { InstanceUser } from '../types';

@Controller('/instance/user')
export class ShimInstanceUserController
  implements ControllerPrototype {
  router: Router;
  logger: Logger;
  name: string;
  baseUri: string;
  initRouter: () => void;

  @Post('/verify')
  async verify(
    request: Request,
  ): Promise<{
    ok: boolean;
    user?: InstanceUser;
  }> {
    const error = HttpErrorFactory.instance('verify', this.logger);
    const instanceId = request.headers['bcms-iid'] as string;
    return await ConnectionService.send(
      instanceId,
      '/user/verify',
      {
        email: request.body.email,
        password: request.body.password,
      },
      error,
    );
  }

  @Post('/verify/otp')
  async verifyWithOTP(
    request: Request,
  ): Promise<{
    ok: boolean;
    user?: InstanceUser;
  }> {
    const error = HttpErrorFactory.instance('verifyWithOTP', this.logger);
    const instanceId = request.headers['bcms-iid'] as string;
    return await ConnectionService.send(
      instanceId,
      '/user/verify/otp',
      {
        email: request.body.otp,
      },
      error,
    );
  }

  @Post('/all')
  async getAll(request: Request): Promise<{ user: InstanceUser[] }> {
    const error = HttpErrorFactory.instance('getAll', this.logger);
    const instanceId = request.headers['bcms-iid'] as string;
    return await ConnectionService.send(
      instanceId,
      '/user/all',
      {},
      error,
    );
  }
}

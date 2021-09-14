import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import { Service } from '../services';
import type { CloudUser } from '../types';
import { Const } from '../util';

export const UserController = createController({
  path: '/shim/instance/user',
  name: 'User controller',
  methods() {
    return {
      verifyWithOtp: createControllerMethod<
        unknown,
        { ok: boolean; user?: CloudUser }
      >({
        path: '/verify/otp',
        type: 'post',
        async handler({ errorHandler, request }) {
          const instanceId = request.headers['bcms-iid'] as string;
          if (ShimConfig.local) {
            return {
              ok: true,
              user: Const.dev.user,
            };
          }
          return await Service.cloudConnection.send(
            instanceId,
            '/user/verify/otp',
            {
              otp: request.body.otp,
            },
            errorHandler,
          );
        },
      }),

      getAll: createControllerMethod<
        unknown,
        { user: CloudUser[] }
      >({
        path: '/all',
        type: 'post',
        async handler({ errorHandler, request }) {
          const instanceId = request.headers['bcms-iid'] as string;
          if (process.env.BCMS_LOCAL === 'true') {
            return {
              user: [Const.dev.user],
            };
          }
          return await Service.cloudConnection.send(
            instanceId,
            '/user/all',
            {},
            errorHandler,
          );
        },
      }),
    };
  },
});

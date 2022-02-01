import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import { Service } from '../services';
import type { CloudUser } from '../types';
import { Const } from '../util';

export const InstanceController = createController({
  name: 'Instance controller',
  path: '/shim/instance',
  methods() {
    return {
      userVerifyWithOtp: createControllerMethod<
        unknown,
        { ok: boolean; user?: CloudUser }
      >({
        path: '/user/verify/otp',
        type: 'post',
        async handler({ errorHandler, request }) {
          const instanceId = request.headers['bcms-iid'] as string;
          if (ShimConfig.local) {
            if (request.query.user) {
              return {
                ok: true,
                user: Const.dev.normalUser,
              };
            }
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
      userGetAll: createControllerMethod<
        unknown,
        { users: CloudUser[] }
      >({
        path: '/user/all',
        type: 'post',
        async handler({ errorHandler, request }) {
          const instanceId = request.headers['bcms-iid'] as string;
          if (ShimConfig.local) {
            return {
              users: [Const.dev.user, Const.dev.normalUser],
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
      userGet: createControllerMethod<unknown, { user: CloudUser[] }>(
        {
          path: '/user/:id',
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
              `/user/${request.params.id}`,
              {},
              errorHandler,
            );
          },
        },
      ),

      pluginVerify: createControllerMethod<unknown, { ok: boolean }>({
        path: '/plugin/verify/:name',
        type: 'post',
        async handler() {
          if (ShimConfig.local) {
            return {
              ok: true,
            };
          }
          return { ok: false };
        },
      }),

      healthCheck: createControllerMethod<unknown, { ok: boolean }>({
        path: '/health',
        type: 'post',
        async handler() {
          return {
            ok: true,
          };
        },
      }),
    };
  },
});

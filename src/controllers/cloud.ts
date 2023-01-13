import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';
import {
  ControllerMethodPreRequestHandler,
  HTTPStatus,
} from '@becomes/purple-cheetah/types';
import { ShimConfig } from '../config';
import { Manager } from '../manager';
import { Service } from '../services';
import type {
  CloudInstanceDomain,
  CloudInstanceFJEWithCode,
  CloudInstancePlugin,
  SecurityObject,
} from '../types';
import { CloudSocket } from '../util';

interface Setup {
  security<Payload>(): ControllerMethodPreRequestHandler<{
    payload: Payload;
    iid: string;
  }>;
}

export const CloudController = createController<Setup>({
  name: 'Cloud controller',
  path: '/shim/cloud',
  setup() {
    return {
      security<Payload>() {
        return async ({ request, errorHandler }) => {
          if (!request.headers['bcms-iid']) {
            throw errorHandler.occurred(
              HTTPStatus.FORBIDDEN,
              'Missing instance ID.',
            );
          }
          try {
            const payload = Service.security.dec<Payload>(
              request.headers['bcms-iid'] as string,
              request.body,
            );
            return {
              payload,
              iid: request.headers['bcms-iid'] as string,
            };
          } catch (error) {
            throw errorHandler.occurred(
              HTTPStatus.UNAUTHORIZED,
              'Invalid request.',
            );
          }
        };
      },
    };
  },
  methods({ security }) {
    return {
      userUpdate: createControllerMethod<
        {
          payload: {
            _id: string;
          };
          iid: string;
        },
        SecurityObject
      >({
        path: '/user/update',
        type: 'post',
        preRequestHandler: security(),
        async handler({ payload, iid, errorHandler }) {
          const cont = Manager.m.container.findById(iid);
          if (!cont) {
            throw errorHandler.occurred(
              HTTPStatus.INTERNAL_SERVER_ERROR,
              'No connection',
            );
          }
          await cont.sendRequest({
            path: '/calls/user/update',
            payload,
          });

          return Service.security.enc(iid, {
            ok: true,
          });
        },
      }),
      updateData: createControllerMethod<
        {
          payload: {
            domains: CloudInstanceDomain[];
            functions: CloudInstanceFJEWithCode[];
            events: CloudInstanceFJEWithCode[];
            jobs: CloudInstanceFJEWithCode[];
            plugins: CloudInstancePlugin[];
          };
          iid: string;
        },
        SecurityObject
      >({
        path: '/update-data',
        type: 'post',
        preRequestHandler: security(),
        async handler({ payload, iid }) {
          if (ShimConfig.manage) {
            const cont = Manager.m.container.findById(iid);
            if (cont) {
              CloudSocket.close(iid);
              const thingsToUpdate = await cont.update(payload);
              if (
                thingsToUpdate.events ||
                thingsToUpdate.functions ||
                thingsToUpdate.jobs ||
                thingsToUpdate.plugins ||
                thingsToUpdate.deps ||
                thingsToUpdate.env
              ) {
                await Manager.m.container.build(iid);
                await Manager.m.container.run(iid);
              }
              if (
                thingsToUpdate.domains ||
                thingsToUpdate.proxyConfig
              ) {
                await Manager.m.nginx.updateConfig();
                await Manager.m.nginx.stop();
                await Manager.m.nginx.build();
                await Manager.m.nginx.run();
              }
            }
          }
          return Service.security.enc(iid, {
            ok: true,
          });
        },
      }),
      getLogs: createControllerMethod<
        {
          iid: string;
        },
        SecurityObject
      >({
        path: '/logs',
        type: 'get',
        preRequestHandler: security(),
        async handler({ iid }) {
          CloudSocket.open(iid);
          return Service.security.enc(iid, {
            ok: true,
          });
        },
      }),
    };
  },
});

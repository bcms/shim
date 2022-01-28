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
  CloudInstanceFJE,
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
      test: createControllerMethod<
        {
          payload: {
            test: string;
          };
          iid: string;
        },
        SecurityObject
      >({
        path: '/test',
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
          console.log({ payload });

          return Service.security.enc(iid, {
            test: 'pong',
          });
        },
      }),
      updateData: createControllerMethod<
        {
          payload: {
            domains: CloudInstanceDomain[];
            functions: CloudInstanceFJE[];
            events: CloudInstanceFJE[];
            jobs: CloudInstanceFJE[];
          };
          iid: string;
        },
        { ok: boolean }
      >({
        path: '/update-data',
        type: 'post',
        preRequestHandler: security(),
        async handler({ payload, iid }) {
          if (ShimConfig.manage) {

            const cont = Manager.m.container.findById(iid);
            if (cont) {
              await cont.update(payload);
              await Manager.m.container.build(iid);
              await Manager.m.container.run(iid);
            }
          }
          return {
            ok: true,
          };
        },
      }),
      getLogs: createControllerMethod<
        void,
        {
          ok: boolean;
        }
      >({
        path: '/logs',
        type: 'get',
        async handler() {
          CloudSocket.open('6169756ef956f26df700c2d7');
          return {
            ok: false,
          };
        },
      }),
    };
  },
});

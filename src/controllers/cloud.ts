import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';
import {
  ControllerMethodPreRequestHandler,
  HTTPStatus,
} from '@becomes/purple-cheetah/types';
import { Manager } from '../manager';
import { Service } from '../services';
import type {
  CloudInstanceData,
  CloudInstanceDomain,
  CloudInstanceFJE,
} from '../types';

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
          const cont = Manager.m.container.findById(iid);
          if (cont) {
            await cont.update(payload);
            await Manager.m.container.build(iid);
            await Manager.m.container.run(iid);
          }
          return {
            ok: true,
          };
        },
      }),
    };
  },
});

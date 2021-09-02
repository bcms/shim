import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';

export const PluginController = createController({
  path: '/shim/instance/plugin',
  name: 'Plugin controller',
  methods() {
    return {
      verify: createControllerMethod<unknown, { ok: boolean }>({
        path: '/verify/:name',
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
    };
  },
});

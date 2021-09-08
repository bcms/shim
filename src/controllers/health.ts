import {
  createController,
  createControllerMethod,
} from '@becomes/purple-cheetah';

export const HealthController = createController({
  name: 'Health controller',
  path: '/shim/instance/health',
  methods() {
    return {
      check: createControllerMethod<unknown, { ok: boolean }>({
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

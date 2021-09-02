import type { ShimConfig as ShimConfigType } from './types';

export const ShimConfig: ShimConfigType = {
  local: process.env.BCMS_LOCAL === 'true',
  cloud: {
    domain: process.env.BCMS_CLOUD_DOMAIN || 'localhost',
    port: process.env.BCMS_CLOUD_PORT || '8081',
  },
  // Are initialized in `main.ts` file.
  instance: undefined,
  security: undefined,
  connection: undefined,
};

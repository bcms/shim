import type { ShimConfig as ShimConfigType } from './types';

export const ShimConfig: ShimConfigType = {
  local: process.env.BCMS_LOCAL === 'true',
  manage: process.env.BCMS_MANAGE
    ? process.env.BCMS_MANAGE === 'true'
      ? true
      : false
    : true,
  containerName: process.env.BCMS_SHIM_CONTAINER_NAME || 'bcms-shim',
  cloud: {
    domain: process.env.BCMS_CLOUD_DOMAIN,
    port: process.env.BCMS_CLOUD_PORT || '8081',
  },
  portRange: {
    from: process.env.BCMS_INSTANCE_PORT_FROM
      ? parseInt(process.env.BCMS_INSTANCE_PORT_FROM)
      : 1280,
    to: process.env.BCMS_INSTANCE_PORT_TO
      ? parseInt(process.env.BCMS_INSTANCE_PORT_TO)
      : 1300,
  },
  storagePathOnHost:
    process.env.BCMS_STORAGE_PATH_ON_HOST || '/var/lib/bcms/storage',
};

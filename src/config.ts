export class ShimConfig {
  static port = process.env.PORT
    ? parseInt(process.env.PORT, 10)
    : 8080;
  static local = process.env.BCMS_LOCAL === 'true';
  static manage = process.env.BCMS_MANAGE
    ? process.env.BCMS_MANAGE === 'true'
      ? true
      : false
    : true;

  static containerName =
    process.env.BCMS_SHIM_CONTAINER_NAME || 'bcms-shim';

  static get cloud() {
    return {
      domain: process.env.BCMS_CLOUD_DOMAIN,
      port: process.env.BCMS_CLOUD_PORT || '8081',
    };
  }

  static get portRange() {
    return {
      from: process.env.BCMS_INSTANCE_PORT_FROM
        ? parseInt(process.env.BCMS_INSTANCE_PORT_FROM)
        : 1280,
      to: process.env.BCMS_INSTANCE_PORT_TO
        ? parseInt(process.env.BCMS_INSTANCE_PORT_TO)
        : 1300,
    };
  }

  static storagePathOnHost =
    process.env.BCMS_STORAGE_PATH_ON_HOST || '/var/lib/bcms/storage';
}

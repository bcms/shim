import type {
  License,
  LicenseService as LicenseServiceType,
} from '../types';
import { General } from '../util';

export function createLicenseService(): LicenseServiceType {
  const licenses: { [instanceId: string]: License } = {};

  return {
    getInstanceIds() {
      return Object.keys(licenses);
    },
    add(instanceId, license) {
      const licenseCore = General.string.getTextBetween(
        license,
        '---- BEGIN BCMS LICENSE ----\n',
        '\n---- END BCMS LICENSE ----',
      );
      const licenseParts: string[] = licenseCore.split('\n');
      if (licenseParts.length !== 20) {
        throw Error('Invalid license length.');
      }
      licenses[instanceId] = {
        list: licenseParts.map((e) => {
          return { str: e, buf: Buffer.from(e, 'base64') };
        }),
      };
    },
    remove(instanceId) {
      delete licenses[instanceId];
    },
    get(instanceId) {
      return licenses[instanceId];
    },
  };
}

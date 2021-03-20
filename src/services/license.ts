import { General } from '../util';

export interface License {
  list: Array<{
    buf: Buffer;
    str: string;
  }>;
}
export interface LicenseServicePrototype {
  add(instanceId: string, license: string): void;
  remove(instanceId: string): void;
  get(instanceId: string): License;
  getInstanceIds(): string[];
}

export function LicenseService() {
  const licenses: { [instanceId: string]: License } = {};
  const self: LicenseServicePrototype = {
    getInstanceIds() {
      return Object.keys(licenses);
    },
    add(instanceId, license) {
      const licenseCore = General.string.getTextBetween(
        license,
        '---- BEGIN LICENSE ----\n',
        '\n---- END LICENSE ----',
      );
      const licenseParts: string[] = licenseCore.split('\n');
      if (licenseParts.length !== 10) {
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
  return self;
}

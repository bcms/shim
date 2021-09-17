import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { watch } from 'chokidar';
import * as path from 'path';
import { Service } from '.';
import type { License } from '../types';
import { General } from '../util';

export function createLicenseService(): Module {
  return {
    name: 'License service',
    initialize({ next }) {
      const licenses: { [instanceId: string]: License } = {};
      const logger = useLogger({ name: 'License service' });
      const watcher = watch(path.join(process.cwd(), 'licenses'));
      const fs = useFS();

      function add(instId: string, license: string) {
        const licenseCore = General.string.getTextBetween(
          license,
          '---- BEGIN BCMS LICENSE ----\n',
          '\n---- END BCMS LICENSE ----',
        );
        const licenseParts: string[] = licenseCore.split('\n');
        if (licenseParts.length !== 20) {
          throw Error('Invalid license length.');
        }
        licenses[instId] = {
          list: licenseParts.map((e) => {
            return { str: e, buf: Buffer.from(e, 'base64') };
          }),
        };
      }
      async function checkLicense(
        location: string,
      ): Promise<{ licenseRaw: string; instId: string } | undefined> {
        const pathParts = location.split('/');
        const licenseName = pathParts[pathParts.length - 1];
        if (licenseName.endsWith('.license')) {
          const instId = licenseName.split('.')[0];
          const licenseRaw = (await fs.read(location)).toString();
          try {
            const res = await Service.cloudConnection.http.send<{
              ok: boolean;
            }>({
              path: `/instance/valid/${instId}`,
              method: 'POST',
            });
            if (res.status === 200 && res.data.ok) {
              add(instId, licenseRaw);
            }
            return { licenseRaw, instId };
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            logger.error(
              'init',
              `Invalid license file ${licenseName}`,
            );
          }
        }
      }

      Service.license = {
        getInstanceIds() {
          return Object.keys(licenses);
        },
        // add(instanceId, license) {
        //   const licenseCore = General.string.getTextBetween(
        //     license,
        //     '---- BEGIN BCMS LICENSE ----\n',
        //     '\n---- END BCMS LICENSE ----',
        //   );
        //   const licenseParts: string[] = licenseCore.split('\n');
        //   if (licenseParts.length !== 20) {
        //     throw Error('Invalid license length.');
        //   }
        //   licenses[instanceId] = {
        //     list: licenseParts.map((e) => {
        //       return { str: e, buf: Buffer.from(e, 'base64') };
        //     }),
        //   };
        // },
        // remove(instanceId) {
        //   delete licenses[instanceId];
        // },
        get(instanceId) {
          return licenses[instanceId];
        },
      };
      next();
    },
  };
}

import * as path from 'path';
import type { LicenseService } from '../types';
import { watch } from 'chokidar';
import type { Module } from '@becomes/purple-cheetah/types';
import { Service } from '.';
import { useFS, useLogger } from '@becomes/purple-cheetah';

export function createLicenseWatcherService(): Module {
  return {
    name: 'License watcher',
    initialize({ next }) {
      const logger = useLogger({ name: 'License watcher' });
      const watcher = watch(path.join(process.cwd(), 'licenses'));
      const fs = useFS();

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
              Service.license.add(instId, licenseRaw);
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

      watcher.on('add', async (location) => {
        const checkResult = await checkLicense(location);
        if (checkResult) {
          const { instId, licenseRaw } = checkResult;
        }
      });

      next();
    },
  };
}

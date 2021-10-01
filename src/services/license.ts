import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { watch } from 'chokidar';
import * as path from 'path';
import { Service } from '.';
import { ShimConfig } from '../config';
import type { License } from '../types';
import { General, Http } from '../util';

export function createLicenseService(): Module {
  return {
    name: 'License service',
    initialize({ next }) {
      const licenses: { [instanceId: string]: License } = {};
      if (ShimConfig.local) {
        next();
        return;
      }
      const logger = useLogger({ name: 'License service' });
      const watcher = watch(path.join(process.cwd(), 'licenses'));
      const fs = useFS();
      const http = !ShimConfig.cloud.domain
        ? new Http('cloud.thebcms.com', '443', '/api/v1/shim')
        : new Http(
            ShimConfig.cloud.domain,
            ShimConfig.cloud.port,
            '/api/v1/shim',
          );

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
            const res = await http.send<{
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
              'checkLicense',
              `Invalid license file ${licenseName}`,
            );
          }
        }
      }

      watcher.on('add', async (location) => {
        const result = await checkLicense(location);
        if (result) {
          add(result.instId, result.licenseRaw);
        }
        next();
      });
      watcher.on('change', async (location) => {
        const result = await checkLicense(location);
        if (result) {
          add(result.instId, result.licenseRaw);
        }
      });
      watcher.on('unlink', async (location) => {
        if (location.endsWith('.license')) {
          const parts = location.split('/');
          const instId = parts[parts.length - 1].split('.')[0];
          if (instId) {
            delete licenses[instId];
          }
        }
      });

      Service.license = {
        getInstanceIds() {
          return Object.keys(licenses);
        },
        get(instanceId) {
          return licenses[instanceId];
        },
      };
    },
  };
}

import * as path from 'path';
import { useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import * as crypto from 'crypto';
import { Http, System } from '../util';
import { Service } from './main';
import { Repo } from '../repo';
import { ShimConfig } from '../config';

export function createCmsService(): Module {
  return {
    name: 'Create CMS service',
    initialize({ next }) {
      const logger = useLogger({ name: 'CMS service' });
      const http = new Http();
      const secrets: {
        [instanceId: string]: string;
      } = {};
      Service.cms = {
        async nextPost() {
          for (
            let port = ShimConfig.portRange.from;
            port < ShimConfig.portRange.to;
            port++
          ) {
            if (!(await Repo.cms.methods.findByPort(port))) {
              return port;
            }
          }
        },
        createSecret(instanceId) {
          secrets[instanceId] = crypto
            .createHash('sha256')
            .update(Date.now() + crypto.randomBytes(16).toString())
            .digest('hex');

          return secrets[instanceId];
        },
        getSecret(instanceId) {
          return secrets[instanceId];
        },
        async checkHealth(instanceId) {
          const place = 'checkHealth';
          const cms = await Repo.cms.findById(instanceId);
          if (!cms) {
            logger.error(
              place,
              `Instance with ID ${instanceId} does not exist in repository.`,
            );
            return false;
          }
          try {
            const timestamp = '' + Date.now();
            const nonce = crypto.randomBytes(8).toString('hex');
            const res = await http.send<{ ok: boolean }>({
              path: '/api/shim/health',
              host: {
                name: '172.17.0.1',
                port: '' + cms.port,
              },
              method: 'POST',
              headers: {
                timestamp,
                nonce,
                signature: crypto
                  .createHmac('sha256', secrets[instanceId])
                  .update(nonce + timestamp + JSON.stringify({}))
                  .digest('hex'),
              },
            });
            if (res.status === 200 && res.data.ok) {
              return true;
            }
            logger.error(place, res);
          } catch (error) {
            logger.error(place, error);
          }
        },
        streamLogs(instanceId, onChunk) {
          const procStop: {
            exec: () => void;
          } = {} as never;
          const date = new Date();

          System.exec(
            `tail -f ${path.join(
              process.cwd(),
              'storage',
              'instances',
              instanceId,
              'logs',
              `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.log`,
            )}`,
            onChunk,
            procStop,
          );

          return procStop;
        },
      };
      next();
    },
  };
}

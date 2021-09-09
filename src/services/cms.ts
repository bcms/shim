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
        init() {
          setInterval(async () => {
            const insts = await Repo.cms.findAll();
            for (let i = 0; i < insts.length; i++) {
              const inst = insts[i];
              if (Service.cloudConnection.isConnected(inst._id)) {
                try {
                  const health = await Service.cms.checkHealth(
                    inst._id,
                  );
                  if (!health) {
                    if (inst.ok) {
                      inst.ok = false;
                      await Repo.cms.update(inst);
                    }
                  } else {
                    if (!inst.ok) {
                      inst.ok = true;
                      await Repo.cms.update(inst);
                    }
                  }
                } catch (error) {
                  // eslint-disable-next-line no-console
                  console.error(error);
                  if (inst.ok) {
                    inst.ok = false;
                    await Repo.cms.update(inst);
                  }
                }
              }
            }
          }, 5000);
        },
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
          secrets[instanceId] = ShimConfig.manage
            ? crypto
                .createHash('sha256')
                .update(
                  Date.now() + crypto.randomBytes(16).toString(),
                )
                .digest('hex')
            : 'local';

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
              path: '/api/shim/calls/health',
              host: {
                name: '172.17.0.1',
                port: ShimConfig.manage ? '' + cms.port : '1280',
              },
              method: 'POST',
              headers: {
                'bcms-ts': timestamp,
                'bcms-nc': nonce,
                'bcms-sig': crypto
                  .createHmac('sha256', secrets[instanceId])
                  .update(nonce + timestamp + JSON.stringify({}))
                  .digest('hex'),
              },
            });
            if (res.status === 200 && res.data.ok) {
              return true;
            }
            logger.error(place, res);
          } catch (error: any) {
            if (error.code !== 'ECONNREFUSED') {
              logger.error(place, error);
            }
          }
          return false;
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

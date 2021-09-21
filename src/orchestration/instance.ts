import * as path from 'path';
import type { FS } from '@becomes/purple-cheetah/types';
import * as crypto from 'crypto';
import { ShimConfig } from '../config';
import type { Instance } from '../types';
import { Http, System } from '../util';
import { useLogger } from '@becomes/purple-cheetah';

export async function createInstance(config: {
  instanceId: string;
  port: string;
  fs: FS;
}): Promise<Instance> {
  let secret = '';
  const logger = useLogger({ name: 'Instance' });
  const http = new Http('172.17.0.1');

  const self: Instance = {
    stats: {
      id: config.instanceId,
      name: `bcms-instance-${config.instanceId}`,
      port: config.port,
      ip: '172.17.0.1',
      status: 'unknown',
    },
    async checkHealth() {
      const place = 'checkHealth';
      try {
        const timestamp = '' + Date.now();
        const nonce = crypto.randomBytes(8).toString('hex');
        const res = await http.send<{ ok: boolean }>({
          path: '/api/shim/calls/health',
          host: {
            name: self.stats.ip,
            port: ShimConfig.manage ? '' + self.stats.port : '1280',
          },
          method: 'POST',
          headers: {
            'bcms-ts': timestamp,
            'bcms-nc': nonce,
            'bcms-sig': crypto
              .createHmac('sha256', secret)
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
    async createSecret() {
      secret = ShimConfig.manage
        ? crypto
            .createHash('sha256')
            .update(Date.now() + crypto.randomBytes(16).toString())
            .digest('hex')
        : 'local';
      await config.fs.save(
        path.join(
          process.cwd(),
          'storage',
          config.instanceId,
          'shim.json',
        ),
        JSON.stringify({
          code: secret,
          local: false,
          instanceId: config.instanceId,
        }),
      );
      return secret;
    },
    getSecret() {
      return secret;
    },
    streamLogs(onChunk) {
      const date = new Date();

      const proc = System.exec(
        `tail -f ${path.join(
          process.cwd(),
          'storage',
          'instances',
          self.stats.id,
          'logs',
          `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.log`,
        )}`,
        { onChunk },
      );
      proc.awaiter.catch((error) => {
        logger.error('streamLogs', error);
        proc.stop();
      });

      return {
        stop: proc.stop,
      };
    },
  };
  await self.createSecret();
  return self;
}

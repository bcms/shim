import * as path from 'path';
import type { FS } from '@becomes/purple-cheetah/types';
import * as crypto from 'crypto';
import { ShimConfig } from '../config';
import type {
  Instance,
  InstanceConfig,
  InstanceStatus,
  InstanceUpdateResult,
} from '../types';
import { Http, System } from '../util';
import { useLogger } from '@becomes/purple-cheetah';

export async function createInstance(config: {
  instanceId: string;
  port: string;
  fs: FS;
  status?: InstanceStatus;
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
      status: config.status ? config.status : 'unknown',
      previousStatus: 'unknown',
    },
    data: {
      domains: [],
      events: [],
      functions: [],
      jobs: [],
    },
    setStatus(status) {
      self.stats.previousStatus = ('' +
        self.stats.status) as InstanceStatus;
      self.stats.status = status;
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
    async update(data) {
      const output: InstanceUpdateResult = {
        domains: !!data.domains,
        events: !!data.events,
        functions: !!data.functions,
        jobs: !!data.jobs,
      };
      if (data.domains) {
        self.data.domains = data.domains;
      }
      if (data.functions) {
        self.data.functions = [];
        const basePath = `storage/${self.stats.id}/functions`;
        if (await config.fs.exist(basePath)) {
          await config.fs.deleteDir(basePath);
        }
        await config.fs.mkdir(basePath);

        for (let i = 0; i < data.functions.length; i++) {
          const item = data.functions[i];
          self.data.functions.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await config.fs.save(
            `${basePath}/${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      if (data.events) {
        self.data.events = [];
        const basePath = `storage/${self.stats.id}/events`;
        if (await config.fs.exist(basePath)) {
          await config.fs.deleteDir(basePath);
        }
        await config.fs.mkdir(basePath);

        for (let i = 0; i < data.events.length; i++) {
          const item = data.events[i];
          self.data.events.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await config.fs.save(
            `${basePath}/${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      if (data.jobs) {
        self.data.jobs = [];
        const basePath = `storage/${self.stats.id}/jobs`;
        if (await config.fs.exist(basePath)) {
          await config.fs.deleteDir(basePath);
        }
        await config.fs.mkdir(basePath);

        for (let i = 0; i < data.jobs.length; i++) {
          const item = data.jobs[i];
          self.data.jobs.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await config.fs.save(
            `${basePath}/${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      return output;
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
  await config.fs.mkdir(
    path.join(process.cwd(), 'storage', config.instanceId, 'plugins'),
  );
  await config.fs.mkdir(
    path.join(
      process.cwd(),
      'storage',
      config.instanceId,
      'functions',
    ),
  );
  await config.fs.mkdir(
    path.join(process.cwd(), 'storage', config.instanceId, 'events'),
  );
  await config.fs.mkdir(
    path.join(process.cwd(), 'storage', config.instanceId, 'jobs'),
  );
  await config.fs.mkdir(
    path.join(process.cwd(), 'storage', config.instanceId, 'logs'),
  );
  await config.fs.save(
    path.join(
      process.cwd(),
      'storage',
      config.instanceId,
      'Dockerfile',
    ),
    [
      // TODO: add dynamic image version
      'FROM becomes/cms-backend',
      'WORKDIR app',
      'COPY . /app',
      'ENTRYPOINT ["npm", "start"]',
    ].join('\n'),
  );
  // TODO: add method to update config
  // TODO: generate config from BCMS Cloud info.
  await config.fs.save(
    path.join(
      process.cwd(),
      'storage',
      config.instanceId,
      'bcms.config.js',
    ),
    `module.exports = ${JSON.stringify(
      {
        port: parseInt(self.stats.port),
        database: {
          prefix: 'bcms',
          fs: true,
        },
        jwt: {
          expireIn: 1200000,
          scope: 'localhost',
          secret: 'secret',
        },
      } as InstanceConfig,
      null,
      '  ',
    )}`,
  );
  return self;
}

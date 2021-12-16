import * as path from 'path';
import * as crypto from 'crypto';
import { useLogger } from '@becomes/purple-cheetah';
import type { FS } from '@becomes/purple-cheetah/types';
import { ShimConfig } from '../config';
import type {
  CloudInstanceStatus,
  CloudInstanceUpdateResult,
  Container,
} from '../types';
import { Http } from '../util';
import { Docker } from '@banez/docker';

export async function createContainer(config: {
  id: string;
  fs: FS;
  status?: CloudInstanceStatus;
}): Promise<Container> {
  let secret = '';
  const logger = useLogger({ name: `Instance ${config.id}` });
  const http = new Http(`bcms-instance-${config.id}`);

  const self: Container = {
    id: config.id,
    info: {} as never,
    name: `bcms-instance-${config.id}`,
    status: config.status || 'unknown',
    previousStatus: 'unknown',
    data: {
      domains: [],
      events: [],
      functions: [],
      jobs: [],
    },
    setStatus(status) {
      self.previousStatus = self.status as CloudInstanceStatus;
      self.status = status;
    },
    async updateInfo() {
      const result = await Docker.container.info(self.name);
      self.info = result;
      return result;
    },
    async createSecret() {
      secret = ShimConfig.manage
        ? crypto
            .createHash('sha256')
            .update(Date.now() + crypto.randomBytes(16).toString())
            .digest('hex')
        : 'local';
      await config.fs.save(
        path.join(process.cwd(), 'storage', config.id, 'shim.json'),
        JSON.stringify({
          code: secret,
          local: false,
          instanceId: config.id,
        }),
      );
      return secret;
    },
    getSecret() {
      return secret;
    },
    async update(data) {
      const output: CloudInstanceUpdateResult = {
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
        const basePath = `storage/${self.id}/functions`;
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
        const basePath = `storage/${self.id}/events`;
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
        const basePath = `storage/${self.id}/jobs`;
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
    streamLogs({
      onChunk
    }) {
      return Docker.container.tail()
    }
  };

  await self.createSecret();

  return self;
}

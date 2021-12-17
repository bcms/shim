import * as path from 'path';
import * as crypto from 'crypto';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type {
  CloudInstanceConfig,
  CloudInstanceStatus,
  CloudInstanceUpdateResult,
  Container,
} from '../types';
import { Http } from '../util';
import { Docker } from '@banez/docker';
import { ChildProcess } from '@banez/child_process';
import type { DockerArgs } from '@banez/docker/types';
import type { ChildProcessOnChunkHelperOutput } from '@banez/child_process/types';

export async function createContainer(config: {
  id: string;
  port?: string;
  status?: CloudInstanceStatus;
  version?: string;
}): Promise<Container> {
  let secret = '';
  const baseFSPath = path.join(process.cwd(), 'storage', config.id);
  const logger = useLogger({ name: `Instance ${config.id}` });
  const http = new Http(`bcms-instance-${config.id}`);
  const fs = useFS({
    base: baseFSPath,
  });
  let dbInfo: {
    type: 'auto' | 'fs' | 'mongoAtlas' | 'mongoSelfHosted';
    user: string;
    pass: string;
    name: string;
    cluster?: string;
    host?: string;
    port?: string;
  } = {
    type: 'fs',
    user: '',
    pass: '',
    name: 'bcms',
  };
  if (await fs.exist('db-info.json', true)) {
    dbInfo = JSON.parse(await fs.readString('db-info.json'));
  }

  const self: Container = {
    id: config.id,
    info: {} as never,
    port: config.port || '8080',
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
    async checkHealth() {
      const place = 'checkHealth';
      try {
        const timestamp = '' + Date.now();
        const nonce = crypto.randomBytes(8).toString('hex');
        const res = await http.send<{ ok: boolean }>({
          path: '/api/shim/calls/health',
          host: {
            name: self.name,
            port: self.port,
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
      } catch (error) {
        if (error.code !== 'ECONNREFUSED') {
          logger.error(place, error);
        }
      }
      return false;
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
      await fs.save(
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
        const basePath = `functions`;
        if (await fs.exist(basePath)) {
          await fs.deleteDir(basePath);
        }
        await fs.mkdir(basePath);

        for (let i = 0; i < data.functions.length; i++) {
          const item = data.functions[i];
          self.data.functions.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await fs.save(
            `${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      if (data.events) {
        self.data.events = [];
        const basePath = `events`;
        if (await fs.exist(basePath)) {
          await fs.deleteDir(basePath);
        }
        await fs.mkdir(basePath);

        for (let i = 0; i < data.events.length; i++) {
          const item = data.events[i];
          self.data.events.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await fs.save(
            `${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      if (data.jobs) {
        self.data.jobs = [];
        const basePath = `jobs`;
        if (await fs.exist(basePath)) {
          await fs.deleteDir(basePath);
        }
        await fs.mkdir(basePath);

        for (let i = 0; i < data.jobs.length; i++) {
          const item = data.jobs[i];
          self.data.jobs.push({
            hash: item.hash,
            name: item.name,
            type: item.type,
          });
          await fs.save(
            `${item.name}.js`,
            Buffer.from(item.code, 'base64').toString(),
          );
        }
      }
      return output;
    },
    streamLogs({ onChunk }) {
      return Docker.container.tail({
        nameOrId: self.name,
        lines: 100,
        onChunk,
      });
    },
    async remove(options) {
      if (await Docker.container.exists(self.name)) {
        await self.updateInfo();
        if (self.info.State.Running) {
          await Docker.container.stop(self.name);
        }
        if (!options) {
          const exo: ChildProcessOnChunkHelperOutput = {
            err: '',
            out: '',
          };
          await Docker.container.remove(self.name, {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          });
          if (exo.err) {
            logger.error('remove', {
              msg: 'Failed to remove bcms-proxy',
              exo,
            });
          }
          return exo;
        }
        await Docker.container.remove(self.name, options);
      }
    },
    async start(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.start(self.name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('start', {
            msg: 'Failed to start bcms-proxy',
            exo,
          });
        }
        return exo;
      }
      await Docker.container.start(self.name, options);
    },
    async stop(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.stop(self.name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('stop', {
            msg: 'Failed to stop bcms-proxy',
            exo,
          });
        }
        return exo;
      }
      await Docker.container.stop(self.name, options);
    },
    async restart(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.restart(self.name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('restart', {
            msg: 'Failed to restart bcms-proxy',
            exo,
          });
        }
        return exo;
      }
      await Docker.container.restart(self.name, options);
    },
    async build(options) {
      if (await fs.exist('Dockerfile', true)) {
        await fs.deleteFile('Dockerfile');
      }
      await fs.save(
        'Dockerfile',
        [
          `FROM becomes/cms-backend${
            config.version ? ':' + config.version : ''
          }`,
          'WORKDIR app',
          'COPY . /app',
          'ENTRYPOINT ["npm", "start"]',
        ].join('\n'),
      );
      if (await fs.exist('bcms.config.js', true)) {
        await fs.deleteFile('bcms.config.js');
      }
      // TODO: Handle plugins
      await fs.save(
        'bcms.config.js',
        `module.exports = ${JSON.stringify(
          {
            port: 8080,
            database: {
              prefix: 'bcms',
              fs: dbInfo.type === 'fs',
              mongodb:
                dbInfo.type !== 'fs'
                  ? {
                      atlas:
                        dbInfo.type === 'mongoAtlas'
                          ? {
                              cluster: dbInfo.cluster,
                              name: dbInfo.name,
                              password: dbInfo.pass,
                              user: dbInfo.user,
                            }
                          : undefined,
                      selfHosted:
                        dbInfo.type === 'mongoSelfHosted'
                          ? {
                              host: dbInfo.host,
                              name: dbInfo.name,
                              password: dbInfo.pass,
                              port:
                                typeof dbInfo.port === 'number'
                                  ? dbInfo.port
                                  : parseInt(dbInfo.port),
                              user: dbInfo.user,
                            }
                          : undefined,
                    }
                  : undefined,
            },
            jwt: {
              expireIn: 60000,
              scope: self.name,
              secret: jwtSecret,
            },
          } as CloudInstanceConfig,
          null,
          '  ',
        )}`,
      );
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await ChildProcess.advancedExec(
          [`cd ${baseFSPath} &&`, `docker build . -t ${self.name}`],
          {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          },
        ).awaiter;
        if (exo.err) {
          logger.error('build', {
            msg: 'Failed to build bcms-proxy',
            exo,
          });
        }
        return exo;
      }
      await ChildProcess.advancedExec(
        [`cd ${baseFSPath} &&`, `docker build . -t ${self.name}`],
        options,
      ).awaiter;
    },
    async run(options) {
      await self.updateInfo();
      if (await Docker.container.exists(self.name)) {
        if (self.info.State.Running) {
          await Docker.container.stop(self.name);
        }
        await Docker.container.remove(self.name);
      }
      const args: DockerArgs = {
        '-d': [],
        '-v': [
          '/var/run/docker.sock:/var/run/docker.sock',
          `${baseFSPath}/logs:/app/logs`,
          `${baseFSPath}/uploads:/app/uploads`,
        ],
        '--name': self.name,
        '--hostname': self.name,
        '--network': 'bcms',
      };
      args[self.name] = [];
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.run({
          args,
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('run', {
            msg: 'Failed to run bcms-proxy',
            exo,
          });
        }
        return exo;
      }
      await Docker.container.run({
        args,
        onChunk: options ? options.onChunk : undefined,
        doNotThrowError: options
          ? options.doNotThrowError
          : undefined,
      });
    },
  };

  let jwtSecret = crypto
    .createHash('sha256')
    .update(crypto.randomBytes(16).toString() + Date.now())
    .digest('base64');
  if (await fs.exist('jwt-secret.txt', true)) {
    jwtSecret = await fs.readString('');
  }
  await self.createSecret();
  {
    const createDirs = [
      'plugins',
      'events',
      'jobs',
      'logs',
      'uploads',
    ];
    for (let i = 0; i < createDirs.length; i++) {
      const dir = createDirs[i];
      if (await fs.exist(dir)) {
        await fs.deleteDir(dir);
      }
      await fs.mkdir(dir);
    }
  }

  return self;
}

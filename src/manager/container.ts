import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import {
  createHttpClient,
  useFS,
  useLogger,
} from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type {
  CloudInstanceConfig,
  CloudInstanceStatus,
  CloudInstanceUpdateResult,
  Container,
} from '../types';
import { Docker } from '@banez/docker';
import { ChildProcess } from '@banez/child_process';
import type { DockerArgs } from '@banez/docker/types';
import type { ChildProcessOnChunkHelperOutput } from '@banez/child_process/types';
import { HttpClientResponseError } from '@becomes/purple-cheetah/types';
import { Service } from '../services';
import { GithubContainerVersionsManager } from '../util';

export async function createContainer(config: {
  id: string;
  port?: string;
  status?: CloudInstanceStatus;
  version?: string;
}): Promise<Container> {
  let secret = '';
  const baseFSPath = path.join(process.cwd(), 'storage', config.id);
  const logger = useLogger({ name: `Instance ${config.id}` });
  const http = createHttpClient({
    name: `${config.id} http client`,
    host: {
      name: `bcms-instance-${config.id}`,
      port: config.port || '8080',
    },
    basePath: '/api/shim',
  });
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

  async function waitForReady() {
    return await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        self.ready = true;
        resolve();
      }, 60000);
      const proc = spawn(
        'docker',
        ['logs', '--tail', '20', '-f', self.name],
        {
          stdio: 'pipe',
        },
      );
      proc.stdout.on('data', (c: Buffer) => {
        const chunk = c.toString();
        if (
          chunk.includes('Started Successfully') ||
          chunk.includes('[ERROR]')
        ) {
          self.ready = true;
          proc.kill();
          clearTimeout(timeout);
          resolve();
        }
      });
      proc.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      proc.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
      proc.on('disconnect', () => {
        clearTimeout(timeout);
        resolve();
      });
      proc.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  const self: Container = {
    version:
      config.version || GithubContainerVersionsManager.data.curr,
    id: config.id,
    info: undefined,
    port: config.port || '8080',
    name: `bcms-instance-${config.id}`,
    status: config.status || 'unknown',
    previousStatus: 'unknown',
    ready: false,
    data: {
      domains: [],
      events: [],
      functions: [],
      jobs: [],
      plugins: [],
      env: [],
      additionalFiles: [],
    },
    setStatus(status) {
      self.previousStatus = self.status as CloudInstanceStatus;
      self.status = status;
    },
    async sendRequest(data) {
      const timestamp = '' + Date.now();
      const nonce = crypto.randomBytes(8).toString('hex');
      const res = await http.send({
        method: 'post',
        path: data.path,
        headers: {
          'bcms-ts': timestamp,
          'bcms-nc': nonce,
          'bcms-sig': crypto
            .createHmac('sha256', secret)
            .update(nonce + timestamp + JSON.stringify({}))
            .digest('hex'),
        },
        data: data.payload,
      });
      if (res instanceof HttpClientResponseError) {
        return res;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return res.data as any;
    },
    async checkHealth() {
      const place = 'checkHealth';
      try {
        const res = await self.sendRequest<{ ok: boolean }>({
          path: '/calls/health',
          payload: {},
        });
        if (res instanceof HttpClientResponseError) {
          logger.error(place, res);
        } else {
          return res.ok;
        }
      } catch (err) {
        const error = err as { code: string };
        if (error.code !== 'ECONNREFUSED') {
          logger.error(place, error);
        }
      }
      return false;
    },
    async updateInfo() {
      try {
        const result = await Docker.container.info(self.name);
        self.info = result;
        return result;
      } catch (error) {
        return self.info;
      }
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
        domains: false,
        events: !!data.events,
        functions: !!data.functions,
        jobs: !!data.jobs,
        plugins: !!data.plugins,
        deps: !!data.deps,
        proxyConfig: !!data.proxyConfig,
        env: !!data.env,
        additionalFiles: !!data.additionalFiles,
      };
      if (data.domains) {
        let newDomains = false;
        let updateDomains = false;
        const removeDomains = false;
        if (self.data.domains.length !== data.domains.length) {
          output.domains = true;
        } else {
          for (let i = 0; i < data.domains.length; i++) {
            const domain = data.domains[i];
            let found = false;
            for (let j = 0; j < self.data.domains.length; j++) {
              const selfDomain = self.data.domains[j];
              if (domain.name === selfDomain.name) {
                found = true;
                if (domain.proxyConfig !== selfDomain.proxyConfig) {
                  updateDomains = true;
                }
                if (domain.ssl) {
                  if (!selfDomain.ssl) {
                    updateDomains = true;
                  } else if (
                    domain.ssl.crt !== selfDomain.ssl.crt ||
                    domain.ssl.key !== selfDomain.ssl.key
                  ) {
                    updateDomains = true;
                  }
                }
                break;
              }
            }
            if (!found) {
              newDomains = true;
              break;
            }
          }
          for (let i = 0; i < self.data.domains.length; i++) {
            const selfDomain = self.data.domains[i];
            let found = false;
            for (let j = 0; j < data.domains.length; j++) {
              const domain = data.domains[j];
              if (domain.name === selfDomain.name) {
                found = true;
                break;
              }
            }
            if (!found) {
              break;
            }
          }
          if (newDomains || removeDomains || updateDomains) {
            output.domains = true;
          }
        }
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
          self.data.functions.push(item);
          await fs.save(
            [basePath, `${item.name}.js`],
            Buffer.from(item.code as string, 'base64').toString(),
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
          self.data.events.push(item);
          await fs.save(
            [basePath, `${item.name}.js`],
            Buffer.from(item.code as string, 'base64').toString(),
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
          self.data.jobs.push(item);
          await fs.save(
            [basePath, `${item.name}.js`],
            Buffer.from(item.code as string, 'base64').toString(),
          );
        }
      }
      if (data.version) {
        self.version = data.version;
      }
      if (data.plugins) {
        self.data.plugins = [];
        const basePath = `plugins`;
        if (await fs.exist(basePath)) {
          await fs.deleteDir(basePath);
        }
        await fs.mkdir(basePath);

        for (let i = 0; i < data.plugins.length; i++) {
          const item = data.plugins[i];
          if (!item.buffer) {
            const pluginBuffer = await Service.cloudConnection.send<{
              error?: {
                message: string;
              };
              plugin?: {
                type: 'Buffer';
                data: Array<number>;
              };
            }>(self.id, '/plugin', {
              name: item.id,
            });
            if (pluginBuffer.error) {
              logger.warn(
                'pullInstanceData',
                pluginBuffer.error.message,
              );
            } else if (pluginBuffer.plugin) {
              item.buffer = Buffer.from(pluginBuffer.plugin.data);
            }
          }
          self.data.plugins.push({
            id: item.id,
            active: item.active,
            buffer: item.buffer,
            version: item.version,
            name: item.name,
            type: item.type,
            tag: item.tag,
          });
          if (item.active && item.buffer) {
            await fs.save([basePath, item.id + '.tgz'], item.buffer);
          }
        }
      }
      if (data.deps) {
        self.data.deps = data.deps;
        await fs.save(
          'custom-package.json',
          JSON.stringify({
            name: 'custom-packages',
            version: '0.0.1',
            dependencies: data.deps.reduce((prev, curr) => {
              prev[curr.name] = curr.version;
              return prev;
            }, {} as { [name: string]: string }),
          }),
        );
      }
      if (data.proxyConfig) {
        self.data.proxyConfig = data.proxyConfig;
      }
      if (data.env) {
        self.data.env = data.env;
      }
      if (data.additionalFiles) {
        self.data.additionalFiles = data.additionalFiles;
        const basePath = `additional`;
        if (await fs.exist(basePath)) {
          await fs.deleteDir(basePath);
        }
        await fs.mkdir(basePath);

        for (let i = 0; i < data.additionalFiles.length; i++) {
          const item = data.additionalFiles[i];
          await fs.save(
            [basePath, ...item.path.split('/')],
            Buffer.from(item.data, 'base64').toString(),
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
            msg: `Failed to start ${self.name}`,
            exo,
          });
        } else {
          await waitForReady();
        }
        return exo;
      }
      await Docker.container.start(self.name, options);
      await waitForReady();
    },
    async stop(options) {
      self.ready = false;
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
            msg: `Failed to stop ${self.name}`,
            exo,
          });
        }
        return exo;
      }
      await Docker.container.stop(self.name, options);
    },
    async remove(options) {
      self.ready = false;
      if (await Docker.container.exists(self.name)) {
        await self.updateInfo();
        if (self.info && self.info.State && self.info.State.Running) {
          const exo: ChildProcessOnChunkHelperOutput = {
            err: '',
            out: '',
          };
          await Docker.container.stop(self.name, {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          });
          if (exo.err) {
            logger.info('remove - stop', exo);
          }
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
    async restart(options) {
      self.ready = false;
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
        await waitForReady();
        return exo;
      }
      await Docker.container.restart(self.name, options);
      await waitForReady();
    },
    async build(options) {
      if (await fs.exist('Dockerfile', true)) {
        await fs.deleteFile('Dockerfile');
      }
      let additionalArgs: string[] = [];
      if (self.status !== 'safe-mode') {
        additionalArgs = [
          'COPY events /app/events',
          'COPY functions /app/functions',
          'COPY jobs /app/jobs',
          'COPY additional /app/additional',
          'COPY plugins /app/plugins',
        ];
      }
      await fs.save(
        'Dockerfile',
        [
          `FROM becomes/cms-backend${
            self.version ? ':' + self.version : ''
          }`,
          '',
          'WORKDIR /app',
          '',
          ...additionalArgs,
          'COPY uploads /app/uploads',
          'COPY logs /app/logs',
          'COPY bcms.config.js /app/bcms.config.js',
          'COPY shim.json /app/shim.json',
          (await fs.exist('custom-package.json', true))
            ? 'COPY custom-package.json /app/custom-package.json'
            : '',
          '',
          'ENTRYPOINT ["npm", "start"]',
        ].join('\n'),
      );
      if (await fs.exist('bcms.config.js', true)) {
        await fs.deleteFile('bcms.config.js');
      }
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
                        dbInfo.type === 'mongoSelfHosted' ||
                        dbInfo.type === 'auto'
                          ? {
                              host: dbInfo.host,
                              port:
                                typeof dbInfo.port === 'number'
                                  ? dbInfo.port
                                  : parseInt(dbInfo.port as string),
                              user: dbInfo.user,
                              name: dbInfo.name,
                              password: dbInfo.pass,
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
            plugins: self.data.plugins
              .filter((e) => e.active)
              .map((e) => e.tag),
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
            msg: 'Failed to build.',
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
      self.ready = false;
      {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await self.remove({
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
      }
      const args: DockerArgs = {
        '-d': [],
        '-v': [
          `${ShimConfig.storagePathOnHost}/${self.id}/logs:/app/logs`,
          '/var/run/docker.sock:/var/run/docker.sock',
          `${ShimConfig.storagePathOnHost}/${self.id}/uploads:/app/uploads`,
          `${ShimConfig.storagePathOnHost}/bcms-share:/bcms-share`,
        ],
        '--name': self.name,
        '--hostname': self.name,
        '--network': 'bcms',
      };
      if (self.data.env.length > 0) {
        args['-e'] = self.data.env.map(
          (e) => `"${e.name}=${e.value}"`,
        );
      }
      args[self.name] = [];
      const exo: ChildProcessOnChunkHelperOutput = {
        err: '',
        out: '',
      };
      await Docker.container.run({
        args,
        doNotThrowError: options && options.doNotThrowError,
        onChunk:
          options && options.onChunk
            ? options.onChunk
            : ChildProcess.onChunkHelper(exo),
      });
      if (exo.err) {
        logger.error('run', {
          msg: 'Failed to run bcms-instance',
          exo,
        });
      }
      await waitForReady();
      // await Docker.container.run({
      //   args,
      //   onChunk: options ? options.onChunk : ChildProcess.onChunkHelper(exo),
      //   doNotThrowError: options
      //     ? options.doNotThrowError
      //     : undefined,
      // });
      // if (options && options.waitFor) {
      //   await new Promise<void>((resolve) => {
      //     setTimeout(() => {
      //       resolve();
      //     }, options.waitFor);
      //   });
      // }
      return exo;
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
    const createDirs = ['plugins', 'events', 'jobs', 'additional'];
    for (let i = 0; i < createDirs.length; i++) {
      const dir = createDirs[i];
      if (await fs.exist(dir)) {
        await fs.deleteDir(dir);
      }
      await fs.mkdir(dir);
    }
    const createDirsOnlyIfNotAvailable = ['uploads', 'logs'];
    for (let i = 0; i < createDirsOnlyIfNotAvailable.length; i++) {
      const dir = createDirsOnlyIfNotAvailable[i];
      if (!(await fs.exist(dir))) {
        await fs.mkdir(dir);
      }
    }
  }

  return self;
}

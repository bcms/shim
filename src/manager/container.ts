import * as crypto from 'crypto';
import * as path from 'path';
import { createFS } from '@banez/fs';
import type { FS } from '@banez/fs/types';
import { Logger, createHttpClient } from '@becomes/purple-cheetah';
import {
  HttpClient,
  HttpClientResponseError,
} from '@becomes/purple-cheetah/types';
import { spawn } from 'child_process';
import type {
  InstanceAdditionalFile,
  InstanceDep,
  InstanceDomain,
  InstanceEnv,
  InstanceFJEWithCode,
  InstancePlugin,
  InstanceProxyConfig,
} from '@cloud/instance';
import type { DockerContainerInfo } from '@banez/docker/types';
import { Docker } from '@banez/docker';
import { Service } from '@shim/services';

export type ContainerStatus =
  | 'running'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown'
  | 'restarting'
  | 'safe-mode';

export interface ContainerInstanceData {
  domains: InstanceDomain[];
  functions: InstanceFJEWithCode[];
  jobs: InstanceFJEWithCode[];
  events: InstanceFJEWithCode[];
  plugins: InstancePlugin[];
  deps?: InstanceDep[];
  proxyConfig?: InstanceProxyConfig[];
  env: InstanceEnv[];
  additionalFiles: InstanceAdditionalFile[];
}

export interface ContainerInstanceUpdateData {
  domains?: InstanceDomain[];
  functions?: InstanceFJEWithCode[];
  jobs?: InstanceFJEWithCode[];
  events?: InstanceFJEWithCode[];
  plugins?: InstancePlugin[];
  version?: string;
  deps?: InstanceDep[];
  proxyConfig?: InstanceProxyConfig[];
  env?: InstanceEnv[];
  additionalFiles?: InstanceAdditionalFile[];
}

export interface ContainerInstanceUpdateResult {
  domains: boolean;
  functions: boolean;
  events: boolean;
  jobs: boolean;
  plugins: boolean;
  deps: boolean;
  proxyConfig: boolean;
  env: boolean;
  additionalFiles: boolean;
}

export class Container {
  private fsPath: string;
  private name: string;
  private ready = false;
  private fs: FS;
  private logger: Logger;
  private http: HttpClient;
  private previousStatus: ContainerStatus = 'unknown';
  private info?: DockerContainerInfo;

  constructor(
    public config: {
      id: string;
      secret: string;
      port?: string;
      status?: ContainerStatus;
      version?: string;
    },
    private readonly dbInfo: {
      type: 'auto' | 'fs' | 'mongoAtlas' | 'mongoSelfHosted';
      user: string;
      pass: string;
      name: string;
      cluster?: string;
      host?: string;
      port?: string;
    },
    private data: ContainerInstanceData,
  ) {
    this.name = `bcms-instance-${this.config.id}`;
    this.fsPath = path.join(process.cwd(), 'storage', this.config.id);
    this.fs = createFS({
      base: this.fsPath,
    });
    this.logger = new Logger(`Container ${this.config.id}`);
    this.http = createHttpClient({
      name: `HTTP Client for ${this.config.id}`,
      host: {
        name: this.name,
        port: '8080',
      },
      basePath: '/api/shim',
    });
  }

  async waitForReady(maxTime?: number) {
    if (!maxTime) {
      maxTime = 60000;
    }
    return await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.ready = true;
        resolve();
      }, maxTime);
      const proc = spawn(
        'docker',
        ['logs', '--tail', '20', '-f', this.name],
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
          this.ready = true;
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

  setStatus(status: ContainerStatus) {
    this.previousStatus = this.config.status || 'unknown';
    this.config.status = status;
  }

  async sendRequest<Result, Payload = unknown, Err = unknown>(data: {
    path: string;
    payload: Payload;
  }): Promise<Result | HttpClientResponseError<Err>> {
    const timestamp = '' + Date.now();
    const nonce = crypto.randomBytes(8).toString('hex');
    try {
      const res = await this.http.send<Result>({
        method: 'post',
        path: data.path,
        headers: {
          'bcms-ts': timestamp,
          'bcms-nc': nonce,
          'bcms-sig': crypto
            .createHmac('sha256', this.config.secret)
            .update(nonce + timestamp + JSON.stringify({}))
            .digest('hex'),
        },
        data: data.payload,
      });
      return res.data;
    } catch (error) {
      return error as HttpClientResponseError<Err>;
    }
  }

  async checkHealth(): Promise<boolean> {
    const place = 'checkHealth';
    try {
      const res = await this.sendRequest<{ ok: boolean }>({
        path: '/calls/health',
        payload: {},
      });
      if (res instanceof HttpClientResponseError) {
        this.logger.error(place, res);
      } else {
        return res.ok;
      }
    } catch (err) {
      const error = err as { code: string };
      if (error.code !== 'ECONNREFUSED') {
        this.logger.error(place, error);
      }
    }
    return false;
  }

  async updateInfo() {
    try {
      const result = await Docker.container.info(this.name);
      this.info = result;
      return result;
    } catch (error) {
      return this.info;
    }
  }

  getSecret() {
    return this.config.secret;
  }

  async update(
    data: ContainerInstanceUpdateData,
  ): Promise<ContainerInstanceUpdateResult> {
    const output: ContainerInstanceUpdateResult = {
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
      if (this.data.domains.length !== data.domains.length) {
        output.domains = true;
      } else {
        for (let i = 0; i < data.domains.length; i++) {
          const domain = data.domains[i];
          let found = false;
          for (let j = 0; j < this.data.domains.length; j++) {
            const selfDomain = this.data.domains[j];
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
        for (let i = 0; i < this.data.domains.length; i++) {
          const selfDomain = this.data.domains[i];
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
      this.data.domains = data.domains;
    }
    if (data.functions) {
      this.data.functions = [];
      const basePath = `functions`;
      if (await this.fs.exist(basePath)) {
        await this.fs.deleteDir(basePath);
      }
      await this.fs.mkdir(basePath);

      for (let i = 0; i < data.functions.length; i++) {
        const item = data.functions[i];
        if (item.code.F) {
          this.data.functions.push(item);
          await this.fs.save(
            [basePath, `${item._id}.js`],
            `
            const { createBcmsFunction } = require('../src/function');
            ${item.code.imports}
            module.exports.default = createBcmsFunction(async () => {
              ${item.code.init}
              return {
                config: {
                  name: '${item.name}',
                  public: ${item.code.F.public}
                },
                handler: async ({ auth, errorHandler, request, logger }) => {
                  ${item.code.handler}
                },
              };
            });
            `,
          );
        }
      }
    }
    if (data.events) {
      this.data.events = [];
      const basePath = `events`;
      if (await this.fs.exist(basePath)) {
        await this.fs.deleteDir(basePath);
      }
      await this.fs.mkdir(basePath);

      for (let i = 0; i < data.events.length; i++) {
        const item = data.events[i];
        if (item.code.E) {
          this.data.events.push(item);
          await this.fs.save(
            [basePath, `${item._id}.js`],
            `
            const { createBcmsEvent } = require('../src/event');
            ${item.code.imports}
            module.exports.default = createBcmsEvent(async () => {
              ${item.code.init}
              return {
                config: {
                  method: '${item.code.E.method}',
                  scope: '${item.code.E.scope}',
                },
                handler: async ({ scope, method, payload }) => {
                  ${item.code.handler}
                },
              };
            });
            `,
          );
        }
      }
    }
    if (data.jobs) {
      this.data.jobs = [];
      const basePath = `jobs`;
      if (await this.fs.exist(basePath)) {
        await this.fs.deleteDir(basePath);
      }
      await this.fs.mkdir(basePath);

      for (let i = 0; i < data.jobs.length; i++) {
        const item = data.jobs[i];
        if (item.code.J) {
          this.data.jobs.push(item);
          await this.fs.save(
            [basePath, `${item._id}.js`],
            `
            const {createBcmsJob} = require('../src/job');
            ${item.code.imports}
            module.exports.default = createBcmsJob(async () => {
              ${item.code.init}
              return {
                cron: {
                  dayOfMonth: '${item.code.J.dayOfMonth}',
                  dayOfWeek: '${item.code.J.dayOfWeek}',
                  hour: '${item.code.J.hour}',
                  minute: '${item.code.J.minute}',
                  month: '${item.code.J.month}'
                },
                async handler() {
                  ${item.code.handler}
                }
              }
            })
            `,
          );
        }
      }
    }
    if (data.version) {
      this.config.version = data.version;
    }
    if (data.plugins) {
      this.data.plugins = [];
      const basePath = `plugins`;
      if (await this.fs.exist(basePath)) {
        await this.fs.deleteDir(basePath);
      }
      await this.fs.mkdir(basePath);

      for (let i = 0; i < data.plugins.length; i++) {
        const item = data.plugins[i];
        const a = 
        const pluginBuffer = await Service.cloudClient.send<{
          error?: {
            message: string;
          };
          plugin?: {
            type: 'Buffer';
            data: Array<number>;
          };
        }>({
          instanceId: this.config.id,
          path: '/plugin',
          channel: 
          payload: {
            name: item.id,
          },
        });
        if (pluginBuffer.error) {
          logger.warn('pullInstanceData', pluginBuffer.error.message);
        } else if (pluginBuffer.plugin) {
          item.buffer = Buffer.from(pluginBuffer.plugin.data);
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
  }
}

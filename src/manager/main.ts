import * as path from 'path';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { ShimConfig } from '../config';
import type {
  CloudInstanceDomain,
  CloudInstanceFJE,
  CloudInstancePlugin,
  Container,
  Manager as ManagerType,
  Nginx,
} from '../types';
import type { ChildProcessOnChunkHelperOutput } from '@banez/child_process/types';
import { ChildProcess } from '@banez/child_process';
import { Docker } from '@banez/docker';
import { Service } from '../services';
import { createContainer } from './container';
import { createNginx } from './nginx';

export const Manager: {
  m: ManagerType;
} = {
  m: undefined as never,
};

async function init() {
  if (ShimConfig.local) {
    return;
  }
  const logger = useLogger({ name: 'Container manager' });
  const containers: {
    [id: string]: {
      target: Container;
      alive: boolean;
      err: string;
      safe: boolean;
    };
  } = {};
  const fs = useFS({
    base: path.join(process.cwd()),
  });
  let nginx: Nginx;

  Manager.m = {
    container: {
      findAll() {
        return Object.keys(containers).map(
          (id) => containers[id].target,
        );
      },
      findByDomain(domainName) {
        for (const id in containers) {
          const container = containers[id];
          for (
            let i = 0;
            i < container.target.data.domains.length;
            i++
          ) {
            const domain = container.target.data.domains[i];
            if (domain.name === domainName) {
              return container.target;
            }
          }
        }
      },
      findById(id) {
        for (const containerId in containers) {
          if (id === containerId) {
            return containers[containerId].target;
          }
        }
      },
      async build(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.build({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        if (exo.err) {
          logger.error('build', {
            msg: `Failed to build ${cont.name}`,
            exo,
          });
          return false;
        }
        logger.info('build', `Success ${cont.name}`);
        return true;
      },
      async remove(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.remove({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        const c = containers[id];
        if (exo.err) {
          c.err = exo.err;
          c.target.setStatus('down-to-error');
          logger.error('remove', {
            msg: `Failed to remove ${cont.name}`,
            exo,
          });
          return false;
        } else {
          c.target.setStatus('unknown');
          c.err = '';
          c.alive = false;
        }
        logger.info('remove', `Success ${cont.name}`);
        return true;
      },
      async restart(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.restart({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        const c = containers[id];
        if (exo.err) {
          c.err = exo.err;
          c.target.setStatus('down-to-error');
          logger.error('restart', {
            msg: `Failed to restart ${cont.name}`,
            exo,
          });
          return false;
        } else {
          c.err = '';
          c.target.setStatus('active');
          logger.info(
            'restart',
            `Container "${cont.name}" restarted.`,
          );
        }
        logger.info('restart', `Success ${cont.name}`);
        return true;
      },
      async start(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.start({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        const c = containers[id];
        if (exo.err) {
          c.err = exo.err;
          c.target.setStatus('down-to-error');
          logger.error('start', {
            msg: `Failed to start ${cont.name}`,
            exo,
          });
          return false;
        } else {
          c.err = '';
          c.target.setStatus('active');
          logger.info('start', `Container "${cont.name}" started.`);
        }
        logger.info('start', `Success ${cont.name}`);
        return true;
      },
      async stop(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.stop({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        const c = containers[id];
        if (exo.err) {
          c.err = exo.err;
          c.target.setStatus('down-to-error');
          logger.error('stop', {
            msg: `Failed to stop ${cont.name}`,
            exo,
          });
          return false;
        } else {
          c.err = '';
          c.target.setStatus('down');
          logger.info('stop', `Container "${cont.name}" stopped.`);
        }
        return true;
      },
      async run(id) {
        const cont = Manager.m.container.findById(id);
        if (!cont) {
          return true;
        }
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await cont.run({
          onChunk: ChildProcess.onChunkHelper(exo),
          doNotThrowError: true,
        });
        const c = containers[id];
        if (exo.err) {
          c.err = exo.err;
          c.target.setStatus('down-to-error');
          logger.error('run', {
            msg: `Failed to run ${cont.name}`,
            exo,
          });
          return false;
        } else {
          c.err = '';
          c.target.setStatus('active');
          logger.info('run', `Container "${cont.name}" started.`);
        }
        return true;
      },
    },
  };

  async function updateContainerVersions(): Promise<void> {
    for (const contId in containers) {
      const cont = containers[contId];

      if (Service.cloudConnection.isConnected(contId)) {
        try {
          const result = await Service.cloudConnection.send<{
            version: string;
          }>(contId, '/version', {});
          if (result.version !== cont.target.version) {
            await cont.target.update({ version: result.version });
            await cont.target.build();
            await cont.target.run();
          }
        } catch (error) {
          logger.warn('updateContainerVersion', { cont, error });
        }
      }
    }
  }
  async function pullInstanceData(
    cont: Container,
    resolve: (value: boolean) => void,
    run: number,
  ): Promise<void> {
    if (Service.cloudConnection.isConnected(cont.id)) {
      try {
        const result = await Service.cloudConnection.send<{
          domains: CloudInstanceDomain[];
          events: CloudInstanceFJE[];
          functions: CloudInstanceFJE[];
          job: CloudInstanceFJE[];
          plugins: CloudInstancePlugin[];
          version: string;
        }>(cont.id, '/data', {});
        const plugins: CloudInstancePlugin[] = [];
        for (let i = 0; i < result.plugins.length; i++) {
          const plugin = result.plugins[i];
          const pluginBuffer = await Service.cloudConnection.send<{
            error?: {
              message: string;
            };
            plugin?: {
              type: 'Buffer';
              data: Array<number>;
            };
          }>(cont.id, '/plugin', {
            name: plugin.id,
          });
          if (pluginBuffer.error) {
            logger.warn(
              'pullInstanceData',
              pluginBuffer.error.message,
            );
          } else if (pluginBuffer.plugin) {
            plugins.push({
              ...plugin,
              buffer: Buffer.from(pluginBuffer.plugin.data),
            });
          }
        }
        result.plugins = plugins;
        await containers[cont.id].target.update(result);
        await containers[cont.id].target.build();
        await containers[cont.id].target.run({
          waitFor: 1000,
        });
        resolve(true);
      } catch (error) {
        if (run > 20) {
          resolve(false);
          // reject(Error(`Cannot pull data for ${cont.id}`));
        }
        logger.error('pullInstanceData', error);
        setTimeout(() => {
          pullInstanceData(cont, resolve, run + 1);
        }, 1000);
      }
    } else {
      if (run > 20) {
        resolve(false);
        // reject(Error(`Cannot connect to cloud for ${cont.id}`));
      }
      setTimeout(() => {
        pullInstanceData(cont, resolve, run + 1);
      }, 100);
    }
  }
  async function checkInstances() {
    for (const contId in containers) {
      const cont = containers[contId];
      if (cont.target.ready) {
        if (cont.target.status === 'active') {
          if (await cont.target.checkHealth()) {
            cont.alive = true;
          } else {
            cont.alive = false;
          }
        }
        if (!cont.alive) {
          if (cont.target.status === 'active') {
            if (cont.target.previousStatus === 'restarting') {
              await toSafe(contId);
            } else {
              await Manager.m.container.restart(contId);
            }
          } else if (cont.target.status === 'unknown') {
            await Manager.m.container.build(contId);
            await Manager.m.container.run(contId);
          } else if (cont.target.status === 'down') {
            await Manager.m.container.start(contId);
          } else if (cont.target.status === 'down-to-error') {
            if (cont.target.previousStatus !== 'down-to-error') {
              await toSafe(contId);
            }
          }
        }
      }
    }
    // setTimeout(() => {
    //   checkInstances().catch((error) => {
    //     logger.error('checkInstances', error);
    //   });
    // }, 5000);
  }
  async function toSafe(contId: string) {
    const inst = containers[contId];
    const date = new Date();
    const logName = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.log`;
    let shimLog = `No logs for ${logName}`;
    let contLog = `No logs for ${logName}`;

    if (await fs.exist(['storage', 'logs', logName], true)) {
      shimLog = await fs.readString(['storage', 'logs', logName]);
    }
    if (await fs.exist(['storage', contId, 'logs', logName], true)) {
      contLog = await fs.readString([
        'storage',
        contId,
        'logs',
        logName,
      ]);
    } else {
      const exo: ChildProcessOnChunkHelperOutput = {
        err: '',
        out: '',
      };
      await Docker.container.logs({
        nameOrId: `bcms-instance-${contId}`,
        lines: '300',
        options: {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        },
      });
      contLog = exo.out;
    }

    await Service.cloudConnection.log({
      instanceId: contId,
      date: Date.now(),
      err: inst.err,
      shimLog,
      instLog: contLog,
    });
    logger.warn('checkInstances', `Starting safe mode for ${contId}`);
    inst.safe = true;
    if (await Manager.m.container.remove(contId)) {
      await Manager.m.container.run(contId);
      inst.target.previousStatus = 'down-to-error';
    } else {
      inst.target.setStatus('down-to-error');
    }
  }

  // Initialize container manager - Starting processes
  {
    await Docker.image.pull('becomes/cms-backend');
    const contList = await Docker.container.list();
    for (let i = 0; i < contList.length; i++) {
      const contItem = contList[i];
      if (contItem.names.startsWith('bcms-instance-')) {
        const contId = contItem.names.replace('bcms-instance-', '');
        const cont = await createContainer({
          id: contId,
        });
        containers[contId] = {
          alive: false,
          safe: false,
          err: '',
          target: cont,
        };
        await cont.updateInfo();
        if (
          ShimConfig.manage &&
          cont.info &&
          cont.info.State &&
          cont.info.State.Running
        ) {
          const exo: ChildProcessOnChunkHelperOutput = {
            err: '',
            out: '',
          };
          await cont.remove({
            onChunk: ChildProcess.onChunkHelper(exo),
            doNotThrowError: true,
          });
          if (exo.err) {
            logger.warn('init', {
              msg: `Failed to remove ${cont.name}`,
              exo,
            });
          }
        }
        const license = Service.license.get(contId);
        if (!license) {
          delete containers[contId];
        }
      }
    }
    const contIds = Service.license.getInstanceIds();
    for (let i = 0; i < contIds.length; i++) {
      const contId = contIds[i];
      if (!containers[contId]) {
        containers[contId] = {
          target: await createContainer({
            id: contId,
          }),
          alive: false,
          safe: false,
          err: '',
        };
      }
    }
    await Service.cloudConnection.connect();
    if (ShimConfig.manage) {
      nginx = createNginx({ manager: Manager.m });
      await nginx.updateConfig();
      await nginx.build();
      await nginx.run();
      const ids = Object.keys(containers);
      let pointer = 0;
      let loop = true;
      while (loop) {
        const cont = containers[ids[pointer]];
        if (
          await new Promise<boolean>((resolve) => {
            pullInstanceData(cont.target, resolve, 0);
          })
        ) {
          pointer++;
          if (pointer === ids.length) {
            loop = false;
          }
        } else {
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 1000);
          });
        }
      }
      await nginx.updateConfig();
      await nginx.copyConfigToContainer();

      checkInstances().catch((err) => {
        logger.error('checkInstance', err);
      });
      setInterval(() => {
        checkInstances().catch((err) => {
          logger.error('checkInstance', err);
        });
      }, 5000);
      setInterval(() => {
        updateContainerVersions().catch((err) => {
          logger.error('updateContainerVersion', err);
        });
      }, 60000);
    } else {
      for (const contId in containers) {
        containers[contId].target.setStatus('active');
        containers[contId].alive = true;
      }
      setInterval(async () => {
        for (const contId in containers) {
          const cont = containers[contId];
          if (await cont.target.checkHealth()) {
            cont.alive = true;
          } else {
            cont.alive = false;
          }
        }
      }, 5000);
    }
  }
}

export function createManager(): Module {
  return {
    name: 'Container manager',
    initialize({ next }) {
      init()
        .then(() => next())
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(err);

          next(
            Error(
              JSON.stringify(
                {
                  message: err.message,
                  stack: err.stack,
                },
                null,
                '  ',
              ),
            ),
          );
        });
    },
  };
}

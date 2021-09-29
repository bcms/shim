import * as path from 'path';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { createDocker, createInstance } from '.';
import { ShimConfig } from '../config';
import { Service } from '../services';
import type {
  Instance,
  InstanceDomain,
  Nginx,
  Orchestration as OrchestrationType,
  OrchestrationMain,
} from '../types';
import { System } from '../util';
import { createNginx } from './nginx';

export const Orchestration: OrchestrationType = {} as never;

export function createInstanceOrchestration(): Module {
  return {
    name: 'Orchestration',
    initialize({ next }) {
      const logger = useLogger({ name: 'Orchestration' });
      const docker = createDocker();
      const insts: {
        [id: string]: {
          target: Instance;
          alive: boolean;
          err: string;
          safe: boolean;
        };
      } = {};
      const fs = useFS({
        base: process.cwd(),
      });
      let nginx: Nginx;
      const pullInstanceDataQueue: boolean[] = [];

      function nextPort() {
        const takenPorts = Object.keys(insts).map(
          (instId) => insts[instId].target.stats.port,
        );
        for (
          let port = ShimConfig.portRange.from;
          port < ShimConfig.portRange.to;
          port++
        ) {
          const sPort = '' + port;
          if (!takenPorts.find((e) => e === sPort)) {
            return sPort;
          }
        }
      }
      async function toSafe(instId: string) {
        const inst = insts[instId];
        const date = new Date();
        const logName = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}.log`;
        let shimLog = `No logs for ${logName}`;
        let instLog = `No logs for ${logName}`;

        if (
          await fs.exist(
            path.join(process.cwd(), 'storage', 'logs', logName),
            true,
          )
        ) {
          shimLog = (
            await fs.read(
              path.join(process.cwd(), 'storage', 'logs', logName),
            )
          ).toString();
        }
        if (
          await fs.exist(
            path.join(
              process.cwd(),
              'storage',
              instId,
              'logs',
              logName,
            ),
            true,
          )
        ) {
          instLog = (
            await fs.read(
              path.join(
                process.cwd(),
                'storage',
                instId,
                'logs',
                logName,
              ),
            )
          ).toString();
        } else {
          try {
            instLog = await docker.containerLogs(
              `bcms-instance-${instId}`,
              300,
            );
          } catch (error) {
            // Do nothing.
          }
        }

        await Service.cloudConnection.log({
          instanceId: instId,
          date: Date.now(),
          err: inst.err,
          shimLog,
          instLog,
        });
        logger.warn(
          'checkInstances',
          `Starting safe mode for ${instId}`,
        );
        inst.safe = true;
        if (await self.remove(instId)) {
          await self.start(instId);
          inst.target.stats.previousStatus = 'down-to-error';
        } else {
          inst.target.setStatus('down-to-error');
        }
      }
      async function checkInstances() {
        for (const instId in insts) {
          const inst = insts[instId];
          if (inst.target.stats.status === 'active') {
            if (await inst.target.checkHealth()) {
              inst.alive = true;
            } else {
              inst.alive = false;
            }
          }
          if (!inst.alive) {
            if (inst.target.stats.status === 'active') {
              if (inst.target.stats.previousStatus === 'restarting') {
                await toSafe(instId);
              } else {
                await self.restart(instId);
              }
            } else if (inst.target.stats.status === 'unknown') {
              await self.run(instId);
            } else if (inst.target.stats.status === 'down') {
              await self.start(instId);
            } else if (inst.target.stats.status === 'down-to-error') {
              if (
                inst.target.stats.previousStatus !== 'down-to-error'
              ) {
                await toSafe(instId);
              }
            }
          }
        }
        setTimeout(() => {
          checkInstances().catch((error) => {
            logger.error('checkInstances', error);
          });
        }, 5000);
      }
      async function pullInstanceData({
        firstRun,
        instId,
        queueIndex,
      }: {
        firstRun?: boolean;
        instId: string;
        queueIndex: number;
      }) {
        if (Service.cloudConnection.isConnected(instId)) {
          const inst = insts[instId];
          try {
            const result = await Service.cloudConnection.send<{
              domains: InstanceDomain[];
            }>(instId, '/domains', {});
            inst.target.data.domains = result.domains;
            pullInstanceDataQueue[queueIndex] = true;
            if (!firstRun && !pullInstanceDataQueue.find((e) => !e)) {
              await nginx.updateConfig();
            }
          } catch (error) {
            logger.error('init-domains', error);
            setTimeout(async () => {
              await pullInstanceData({ instId, queueIndex });
            }, 1000);
          }
        } else {
          setTimeout(async () => {
            await pullInstanceData({ instId, queueIndex });
          }, 1000);
        }
      }

      async function init() {
        /**
         * List of available instances vie Docker CLI.
         */
        const inspects = await docker.inspectContainers();
        for (let i = 0; i < inspects.length; i++) {
          const inspect = inspects[i];
          const license = Service.license.get(inspect.id);
          insts[inspect.id] = {
            target: await createInstance({
              instanceId: inspect.id,
              fs,
              port: nextPort(),
            }),
            alive: false,
            safe: false,
            err: '',
          };
          if (inspect.up) {
            await self.stop(inspect.id);
          }
          await self.remove(inspect.id);
          if (!license) {
            delete insts[inspect.id];
          }
        }
        const instIds = Service.license.getInstanceIds();
        for (let i = 0; i < instIds.length; i++) {
          const instId = instIds[i];
          if (!insts[instId]) {
            insts[instId] = {
              target: await createInstance({
                fs,
                instanceId: instId,
                port: nextPort(),
              }),
              alive: false,
              safe: false,
              err: '',
            };
          }
        }

        await Service.cloudConnection.connect();
        if (ShimConfig.manage) {
          for (const instId in insts) {
            const queueIndex = pullInstanceDataQueue.push(false) - 1;
            await pullInstanceData({
              firstRun: true,
              instId,
              queueIndex,
            });
          }
          nginx = await createNginx({ orch: self });
          await nginx.run();
          checkInstances().catch((error) => {
            logger.error('checkInstances', error);
          });
        } else {
          for (const instId in insts) {
            insts[instId].target.setStatus('active');
            insts[instId].alive = true;
          }
          setInterval(async () => {
            for (const instId in insts) {
              const inst = insts[instId];
              if (await inst.target.checkHealth()) {
                inst.alive = true;
              } else {
                inst.alive = false;
              }
            }
          }, 5000);
        }
      }

      const self: OrchestrationMain = {
        getInstance(instId) {
          return insts[instId] ? insts[instId].target : undefined;
        },
        listInstances(query) {
          if (!query) {
            return Object.keys(insts).map((e) => insts[e].target);
          }
          const output: Instance[] = [];
          const instIds = Object.keys(insts);
          for (let i = 0; i < instIds.length; i++) {
            const instId = instIds[i];
            if (query(insts[instId].target)) {
              output.push(insts[instId].target);
            }
          }
          return output;
        },
        async remove(instId) {
          if (insts[instId]) {
            const inst = insts[instId];
            const containerName = inst.target.stats.name;
            const exo = {
              out: '',
              err: '',
            };
            await System.exec(
              ['docker', 'stop', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              logger.error('remove', {
                msg: `Failed to stop container "${containerName}"`,
                exo,
              });
            } else {
              logger.info(
                'remove',
                `Container "${containerName}" stopped.`,
              );
            }
            await System.exec(
              ['docker', 'rm', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              logger.error('remove', {
                msg: `Failed to remove container "${containerName}"`,
                exo,
              });
              return false;
            } else {
              logger.info(
                'remove',
                `Container "${containerName}" removed.`,
              );
              // delete insts[instId];
            }
            await System.exec(
              ['docker', 'rmi', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              inst.target.setStatus('down-to-error');
              logger.error('remove', {
                msg: `Failed to remove image "${containerName}"`,
                exo,
              });
              return false;
            } else {
              inst.target.setStatus('unknown');
              inst.err = '';
              inst.alive = false;
              logger.info(
                'remove',
                `Image "${containerName}" removed.`,
              );
              // delete insts[instId];
            }
            return true;
          }
        },
        async restart(instId) {
          if (insts[instId]) {
            const inst = insts[instId];
            inst.target.setStatus('restarting');
            const containerName = inst.target.stats.name;
            const exo = {
              out: '',
              err: '',
            };
            await System.exec(
              ['docker', 'restart', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              inst.target.setStatus('down-to-error');
              logger.error('restart', {
                msg: `Failed to restart container "${containerName}"`,
                exo,
              });
              return false;
            } else {
              inst.err = '';
              inst.target.setStatus('active');
              logger.info(
                'restart',
                `Container "${containerName}" restarted.`,
              );
            }
            return true;
          }
        },
        async start(instId) {
          if (insts[instId]) {
            const inst = insts[instId];
            const containerName = inst.target.stats.name;
            const exo = {
              out: '',
              err: '',
            };
            await System.exec(
              ['docker', 'start', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              inst.target.setStatus('down-to-error');
              logger.error('start', {
                msg: `Failed to start container "${containerName}"`,
                exo,
              });
              return false;
            } else {
              inst.err = '';
              inst.target.setStatus('active');
              logger.info(
                'start',
                `Container "${containerName}" started.`,
              );
              return true;
            }
          }
        },
        async stop(instId) {
          if (insts[instId]) {
            const inst = insts[instId];
            const containerName = inst.target.stats.name;
            const exo = {
              out: '',
              err: '',
            };
            await System.exec(
              ['docker', 'stop', containerName].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              inst.target.setStatus('down-to-error');
              logger.error('stop', {
                msg: `Failed to stop container "${containerName}"`,
                exo,
              });
              return false;
            } else {
              inst.err = '';
              inst.target.setStatus('down');
              logger.info(
                'stop',
                `Container "${containerName}" stopped.`,
              );
            }
            return true;
          }
        },
        async run(instId) {
          if (insts[instId]) {
            const inst = insts[instId];
            const containerName = inst.target.stats.name;
            const exo = {
              out: '',
              err: '',
            };
            const instanceBasePath = path.join(
              process.cwd(),
              'storage',
              instId,
            );
            await System.exec(
              [
                `cd ${instanceBasePath} &&`,
                `docker build . -t ${containerName} &&`,
                'docker',
                'run',
                '-d',
                '-p',
                `${inst.target.stats.port}:${inst.target.stats.port}`,
                '-v',
                '/var/run/docker.sock:/var/run/docker.sock',
                '-v',
                `${instanceBasePath}/logs:/app/logs`,
                '--name',
                containerName,
                containerName,
              ].join(' '),
              {
                onChunk: System.execHelper(exo),
                doNotThrowError: true,
              },
            ).awaiter;
            if (exo.err) {
              inst.err = exo.err;
              inst.target.setStatus('down-to-error');
              logger.error('run', {
                msg: `Failed to run container "${containerName}"`,
                exo,
              });
              return false;
            } else {
              inst.err = '';
              inst.target.setStatus('active');
              logger.info(
                'run',
                `Container "${containerName}" started.`,
              );
            }

            return true;
          }
        },
        findInstanceByDomainName(name) {
          console.log(JSON.stringify(insts, null, '  '));
          for (const instId in insts) {
            const inst = insts[instId];
            for (
              let i = 0;
              i < inst.target.data.domains.length;
              i++
            ) {
              const domain = inst.target.data.domains[i];
              if (domain.name === name) {
                return inst.target;
              }
            }
          }
          return undefined;
        },
        async updateInstance(data) {
          const inst = insts[data.id];
          if (inst) {
            const result = await inst.target.update(data);
            if (result.domains) {
              await nginx.updateConfig();
              await nginx.copyConfigToContainer();
              await nginx.restart();
            }
            if (result.functions || result.events || result.jobs) {
              await self.remove(inst.target.stats.id);
              return await self.start(inst.target.stats.id);
            }
          }
          return true;
        },
      };

      Orchestration.main = self;

      init()
        .then(() => next())
        .catch((err) => next(err));
    },
  };
}

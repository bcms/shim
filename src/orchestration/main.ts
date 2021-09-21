import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { createDocker, createInstance } from '.';
import { ShimConfig } from '../config';
import { Service } from '../services';
import type {
  Instance,
  InstanceStats,
  Orchestration as OrchestrationType,
} from '../types';
import { System } from '../util';

export const Orchestration: OrchestrationType = {} as never;

export function createInstanceOrchestration(): Module {
  return {
    name: 'Orchestration',
    initialize({ next }) {
      const logger = useLogger({ name: 'Orchestration' });
      const docker = createDocker();
      const insts: {
        [id: string]: {
          data: Instance;
          alive: boolean;
        };
      } = {};
      const fs = useFS();

      function execHelper(exo: {
        out: string;
        err: string;
      }): (type: 'stdout' | 'stderr', chunk: string) => void {
        exo.out = '';
        exo.err = '';
        return (type, chunk) => {
          if (type === 'stdout') {
            exo.out += chunk;
          } else {
            exo.err += chunk;
          }
        };
      }
      function nextPort() {
        const takenPorts = Object.keys(insts).map(
          (instId) => insts[instId].data.stats.port,
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

      async function init() {
        if (!ShimConfig.manage) {
          /**
           * Instances should not be managed.
           */
          return;
        }
        /**
         * List of available instances vie Docker CLI.
         */
        const inspects = await docker.inspectContainers();
        for (let i = 0; i < inspects.length; i++) {
          const inspect = inspects[i];
          const license = Service.license.get(inspect.id);
          if (license) {
            insts[inspect.id] = {
              data: await createInstance({
                instanceId: inspect.id,
                fs,
                port: inspect.port,
              }),
              alive: false,
            };
            if (!inspect.up) {
              await Orchestration.remove(inspect.id);
              insts[inspect.id] = {
                data: await createInstance({
                  instanceId: inspect.id,
                  fs,
                  port: nextPort(),
                }),
                alive: false,
              };
              await Orchestration.start(inspect.id);
            } else {
              insts[inspect.id].data.stats.status = 'active';
            }
          } else {
            await Orchestration.remove(inspect.id);
          }
        }
        const instIds = Service.license.getInstanceIds();
        console.log(instIds);
        for (let i = 0; i < instIds.length; i++) {
          const instId = instIds[i];
          if (!insts[instId]) {
            insts[instId] = {
              data: await createInstance({
                fs,
                instanceId: instId,
                port: nextPort(),
              }),
              alive: true,
            };
            await Orchestration.start(instId);
          }
        }
      }

      Orchestration.getInstance = (instId) => {
        return insts[instId] ? insts[instId].data : undefined;
      };
      Orchestration.listInstances = (query) => {
        if (!query) {
          return Object.keys(insts).map((e) => insts[e].data.stats);
        }
        const output: InstanceStats[] = [];
        const instIds = Object.keys(insts);
        for (let i = 0; i < instIds.length; i++) {
          const instId = instIds[i];
          if (query(insts[instId].data)) {
            output.push(insts[instId].data.stats);
          }
        }
        return output;
      };
      Orchestration.remove = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.data.stats.name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'stop', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
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
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            inst.data.stats.status = 'down-to-error';
            logger.error('remove', {
              msg: `Failed to remove container "${containerName}"`,
              exo,
            });
          } else {
            logger.info(
              'remove',
              `Container "${containerName}" removed.`,
            );
            delete insts[instId];
          }
        }
      };
      Orchestration.restart = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.data.stats.name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'restart', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            inst.data.stats.status = 'down';
            logger.error('restart', {
              msg: `Failed to restart container "${containerName}"`,
              exo,
            });
          } else {
            inst.data.stats.status = 'active';
            logger.info(
              'restart',
              `Container "${containerName}" restarted.`,
            );
          }
        }
      };
      Orchestration.start = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.data.stats.name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'start', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            inst.data.stats.status = 'active';
            logger.error('start', {
              msg: `Failed to start container "${containerName}"`,
              exo,
            });
          } else {
            inst.data.stats.status = 'down-to-error';
            logger.info(
              'start',
              `Container "${containerName}" started.`,
            );
          }
        }
      };
      Orchestration.stop = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.data.stats.name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'stop', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            inst.data.stats.status = 'down';
            logger.error('stop', {
              msg: `Failed to stop container "${containerName}"`,
              exo,
            });
          } else {
            logger.info(
              'stop',
              `Container "${containerName}" stopped.`,
            );
          }
        }
      };

      init()
        .then(() => {
          // setInterval(async () => {
          //   for (const instId in insts) {
          //     const inst = insts[instId];
          //     if (inst.data.stats.status !== 'active') {
          //       inst.alive = false;
          //       if (inst.)
          //     } else {

          //     }
          //   }
          // }, 5000);
          next();
        })
        .catch((err) => next(err));
    },
  };
}

import { useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { ShimConfig } from '../config';
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
      const insts: {
        [id: string]: Instance;
      } = {};

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
          (instId) => insts[instId].stats().port,
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
        
      }

      Orchestration.getInstance = (instId) => {
        return insts[instId];
      };
      Orchestration.listInstances = (query) => {
        if (!query) {
          return Object.keys(insts).map((e) => insts[e].stats());
        }
        const output: InstanceStats[] = [];
        const instIds = Object.keys(insts);
        for (let i = 0; i < instIds.length; i++) {
          const instId = instIds[i];
          if (query(insts[instId])) {
            output.push(insts[instId].stats());
          }
        }
        return output;
      };
      Orchestration.remove = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.stats().name;
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
            logger.error('remove', {
              msg: `Failed to remove container "${containerName}"`,
              exo,
            });
          } else {
            logger.info(
              'remove',
              `Container "${containerName}" removed.`,
            );
          }

          delete insts[instId];
        }
      };
      Orchestration.restart = async (instId) => {
        if (insts[instId]) {
          const inst = insts[instId];
          const containerName = inst.stats().name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'restart', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            logger.error('restart', {
              msg: `Failed to restart container "${containerName}"`,
              exo,
            });
          } else {
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
          const containerName = inst.stats().name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'start', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
            logger.error('start', {
              msg: `Failed to start container "${containerName}"`,
              exo,
            });
          } else {
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
          const containerName = inst.stats().name;
          const exo = {
            out: '',
            err: '',
          };
          await System.exec(
            ['docker', 'stop', containerName].join(' '),
            { onChunk: execHelper(exo), doNotThrowError: true },
          ).awaiter;
          if (exo.err) {
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
        .then(() => next())
        .catch((err) => next(err));
    },
  };
}

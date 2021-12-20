import * as os from 'os';
import { useLogger } from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type {
  CloudConnection,
  Container,
  SecurityObject,
} from '../types';
import { General, Http, System } from '../util';
import { HTTPStatus, Module } from '@becomes/purple-cheetah/types';
import { getHeapStatistics } from 'v8';
import { Service } from './main';
import { Manager } from '../manager';

interface ServerStats {
  cpu: {
    cores: number;
    usage: number;
  };
  ramAvailable: number;
  ramUsed: number;
  diskAvailable: number;
  diskUsed: number;
  heepAvailable: number;
  heepUsed: number;
  lastUpdate: number;
}

export function createCloudConnectionService(): Module {
  const logger = useLogger({ name: 'ShimConnectionService' });
  const http = !ShimConfig.cloud.domain
    ? new Http('cloud.thebcms.com', '443', '/api/v1/shim')
    : new Http(
        ShimConfig.cloud.domain,
        ShimConfig.cloud.port,
        '/api/v1/shim',
      );
  const connections: {
    [instanceId: string]: {
      cloud: CloudConnection;
      self: {
        checkAfter: number;
      };
    };
  } = {};

  async function getStats(): Promise<ServerStats> {
    const heap = getHeapStatistics();
    const mem = await System.memInfo();
    const disk = await System.diskInfo();
    return {
      cpu: {
        cores: os.cpus().length,
        usage: await General.cpu.usage(),
      },
      ramAvailable: mem.total,
      ramUsed: mem.total - mem.available,
      diskAvailable: disk.total,
      diskUsed: disk.used,
      heepAvailable: heap.heap_size_limit,
      heepUsed: heap.used_heap_size,
      lastUpdate: Date.now(),
    };
  }
  async function register(instanceId: string): Promise<boolean> {
    try {
      const stats = await getStats();
      const regObj = Service.security.enc(instanceId, stats);
      const response = await http.send<SecurityObject>({
        path: '/register',
        method: 'POST',
        data: regObj,
        headers: {
          iid: instanceId,
        },
      });
      if (response.status !== 200) {
        logger.warn(
          'register',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${response.status} - ${(response.data as any).message}`,
        );
        return false;
      }
      const resObj: {
        channel: string;
      } = Service.security.dec(instanceId, response.data);
      connections[instanceId].cloud.channel = resObj.channel;
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      logger.error('register', 'Failed');
    }
    return false;
  }
  async function sendStats(
    cont: Container,
    channel: string,
  ): Promise<boolean> {
    try {
      const stats = await getStats();
      const response = await http.send<SecurityObject>({
        path: `/conn/${channel}`,
        method: 'POST',
        data: Service.security.enc(cont.id, {
          ...stats,
          instStatus: cont.status,
        }),
        headers: {
          iid: cont.id,
        },
      });
      if (response.status !== 200) {
        logger.warn(
          'sendStats',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          `${response.status} - ${(response.data as any).message}`,
        );
        return false;
      }
      const resObj: {
        ok: string;
      } = Service.security.dec(cont.id, response.data);
      return !!resObj.ok;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      logger.error('sendStats', 'Failed');
    }
    return false;
  }

  return {
    name: 'Create connection service',
    initialize({ next }) {
      Service.cloudConnection = {
        http,
        async connect() {
          if (!ShimConfig.local) {
            const instIds = Service.license.getInstanceIds();
            for (let i = 0; i < instIds.length; i++) {
              const instId = instIds[i];

              let connection = connections[instId];
              if (!connection) {
                connections[instId] = {
                  cloud: {
                    connected: false,
                    channel: '',
                    registerAfter: Date.now() - 1000,
                    sendStatsAfter: Date.now() - 1000,
                  },
                  self: {
                    checkAfter: -1000,
                  },
                };
              }
              connection = connections[instId];
              if (!connection.cloud.connected) {
                if (connection.cloud.registerAfter < Date.now()) {
                  if (await register(instId)) {
                    connections[instId].cloud.connected = true;
                    logger.info(
                      'register',
                      `Instance "${instId}" successfully registered to the cloud.`,
                    );
                  } else {
                    logger.warn(
                      'register',
                      `Instance "${instId}" failed to register to the cloud.`,
                    );
                    connections[instId].cloud.registerAfter =
                      Date.now() + 10000;
                  }
                }
              } else {
                if (connection.cloud.sendStatsAfter < Date.now()) {
                  const inst = Manager.m.container.findById(instId);
                  if (inst) {
                    if (
                      !(await sendStats(
                        inst,
                        connections[instId].cloud.channel,
                      ))
                    ) {
                      logger.warn(
                        'connection',
                        `Connection failed for "${instId}".`,
                      );
                      connections[instId].cloud.connected = false;
                      connections[instId].cloud.registerAfter =
                        Date.now() + 10000;
                    } else {
                      connections[instId].cloud.sendStatsAfter =
                        Date.now() + 5000;
                    }
                  }
                }
                // TODO: check instance state
              }
            }
            setTimeout(async () => {
              await Service.cloudConnection.connect();
            }, 3000);
          }
        },
        isConnected(instanceId) {
          return connections[instanceId]
            ? connections[instanceId].cloud.connected
            : false;
        },
        async send(instanceId, uri, payload, error) {
          const connection = connections[instanceId];
          if (!connection) {
            if (error) {
              throw error.occurred(
                HTTPStatus.FORBIDDEN,
                'Instance in not connected.',
              );
            }
            throw Error('Instance is not connected.');
          }
          try {
            const response = await http.send<SecurityObject>({
              path: `/conn/${connection.cloud.channel}${uri}`,
              method: 'POST',
              data: Service.security.enc(instanceId, payload),
              headers: {
                iid: instanceId,
              },
            });
            return Service.security.dec(instanceId, response.data);
          } catch (e) {
            logger.error('send', e);
            if (error) {
              throw error.occurred(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                'Failed to send a request.',
              );
            }
            throw Error('Failed to send a request.');
          }
        },
        async log(data) {
          const con = connections[data.instanceId];
          if (con) {
            try {
              const response = await http.send<SecurityObject>({
                path: `/conn/${con.cloud.channel}/log`,
                method: 'POST',
                data: Service.security.enc(data.instanceId, data),
                headers: {
                  iid: data.instanceId,
                },
              });
              if (response.status !== 200) {
                logger.warn(
                  'log',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  `${response.status} - ${
                    (response.data as any).message
                  }`,
                );
              }
              Service.security.dec(data.instanceId, response.data);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error(e);
              logger.error('log', e);
            }
          }
        },
      };
      next();
    },
  };
}

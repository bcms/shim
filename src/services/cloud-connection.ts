import * as os from 'os';
import { useLogger } from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type {
  CloudConnection,
  InstanceServerStats,
  SecurityObject,
} from '../types';
import { General, Http, System } from '../util';
import { HTTPStatus, Module } from '@becomes/purple-cheetah/types';
import { getHeapStatistics } from 'v8';
import { Service } from './main';

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
        available: boolean;
        checkAfter: number;
      };
    };
  } = {};

  setInterval(async () => {
    const licenseService = Service.security.license();
    if (licenseService && !ShimConfig.local) {
      const instIds = licenseService.getInstanceIds();
      for (let i = 0; i < instIds.length; i++) {
        const instId = instIds[i];
        const connection = connections[instId];
        if (!connection) {
          connections[instId] = {
            cloud: {
              connected: false,
              channel: '',
              registerAfter: Date.now() - 1000,
              sendStatsAfter: Date.now() - 1000,
            },
            self: {
              available: false,
              checkAfter: -1000,
            },
          };
        } else {
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
              if (
                !(await sendStats(
                  instId,
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
            // TODO: check instance state
          }
        }
      }
    }
  }, 1000);

  async function getStats(): Promise<InstanceServerStats> {
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
    instanceId: string,
    channel: string,
  ): Promise<boolean> {
    try {
      const stats = await getStats();
      const response = await http.send<SecurityObject>({
        path: `/conn/${channel}`,
        method: 'POST',
        data: Service.security.enc(instanceId, stats),
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
        ok: string;
      } = Service.security.dec(instanceId, response.data);
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
              path: `/conn/${connection.channel}${uri}`,
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
      };
      next();
    },
  };
}

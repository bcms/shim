import * as os from 'os';
import { useLogger } from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type {
  Connection,
  ConnectionService,
  InstanceServerStats,
  SecurityObject,
} from '../types';
import { General, Http } from '../util';
import { HTTPStatus } from '@becomes/purple-cheetah/types';

export function createConnectionService(): ConnectionService {
  const logger = useLogger({ name: 'ShimConnectionService' });
  const http = !ShimConfig.local
    ? new Http('cloud.thebcms.com', '443', '/api/v1/shim')
    : new Http(
        ShimConfig.cloud.domain,
        ShimConfig.cloud.port,
        '/api/v1/shim',
      );
  // const instanceHttp = new Http();
  const connections: { [instanceId: string]: Connection } = {};

  setInterval(async () => {
    const licenseService = ShimConfig.security.license();
    if (licenseService && process.env.BCMS_LOCAL !== 'true') {
      const instanceIds = licenseService.getInstanceIds();
      for (let i = 0; i < instanceIds.length; i++) {
        const instanceId = instanceIds[i];
        if (!connections[instanceId]) {
          connections[instanceId] = {
            connected: false,
            channel: '',
            registerAfter: Date.now() - 1000,
          };
        }
        if (!connections[instanceId].connected) {
          if (connections[instanceId].registerAfter < Date.now()) {
            if (await register(instanceId)) {
              connections[instanceId].connected = true;
              logger.info(
                'register',
                `Instance "${instanceId}" successfully registered to the cloud.`,
              );
            } else {
              logger.warn(
                'register',
                `Instance "${instanceId}" failed to register to the cloud.`,
              );
              connections[instanceId].registerAfter =
                Date.now() + 10000;
            }
          }
        } else {
          if (
            !(await sendStats(
              instanceId,
              connections[instanceId].channel,
            ))
          ) {
            logger.warn(
              'connection',
              `Connection failed for "${instanceId}".`,
            );
            connections[instanceId].connected = false;
          }
        }
        const result = await ShimConfig.instance.checkHealth(
          instanceId,
        );
        if (!result.ok) {
          // eslint-disable-next-line no-console
          console.log('Instance not available');
          // TODO: implement a mechanism for starting new instance
        } else {
          // TODO: do something with data
        }
      }
    }
  }, 1000);

  async function getStats(): Promise<InstanceServerStats> {
    const mem = process.memoryUsage();
    return {
      cpu: {
        cores: os.cpus().length,
        usage: await General.cpu.usage(),
      },
      ramAvailable: os.totalmem(),
      ramUsed: os.totalmem() - os.freemem(),
      diskAvailable: 0,
      diskUsed: 0,
      heepAvailable: mem.heapTotal,
      heepUsed: mem.heapUsed,
      lastUpdate: Date.now(),
    };
  }
  async function register(instanceId: string): Promise<boolean> {
    try {
      const stats = await getStats();
      const regObj = ShimConfig.security.enc(instanceId, stats);
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
      } = ShimConfig.security.dec(instanceId, response.data);
      connections[instanceId].channel = resObj.channel;
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
        data: ShimConfig.security.enc(instanceId, stats),
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
      } = ShimConfig.security.dec(instanceId, response.data);
      return !!resObj.ok;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      logger.error('sendStats', 'Failed');
    }
    return false;
  }

  const self: ConnectionService = {
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
          data: ShimConfig.security.enc(instanceId, payload),
          headers: {
            iid: instanceId,
          },
        });
        return ShimConfig.security.dec(instanceId, response.data);
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
  return self;
}

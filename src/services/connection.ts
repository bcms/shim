import * as os from 'os';
import { SecurityObject, SecurityService } from './security';
import { General, Http } from '../util';
import type {
  BCMSConfig,
  InstanceServerStats,
  UserProtected,
} from '../types';
import { Logger } from '@becomes/purple-cheetah';

export interface ConnectionServicePrototype {
  isConnected(instanceId: string): boolean;
  getBCMSConfig(instanceId: string): Promise<BCMSConfig>;
  log(instanceId: string, message: string): Promise<void>;
  canAccessPlugin(
    instanceId: string,
    pluginHash: string,
  ): Promise<boolean>;
  loginUser(
    instanceId: string,
    cred: {
      email: string;
      password: string;
    },
  ): Promise<UserProtected>;
}
export interface Connection {
  connected: boolean;
  registerAfter: number;
  channel: string;
}

function connectionService() {
  const logger = new Logger('ShimConnectionService');
  const http = new Http('ua728al.becomes.co', '443', '/api/v1/shim');
  const connections: { [instanceId: string]: Connection } = {};

  setInterval(async () => {
    const licenseService = SecurityService.license();
    if (licenseService) {
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
    const stats = await getStats();
    const regObj = SecurityService.enc(instanceId, stats);
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
        `${response.status} - ${(response.data as any).message}`,
      );
      return false;
    }
    const resObj: {
      channel: string;
    } = SecurityService.dec(instanceId, response.data);
    connections[instanceId].channel = resObj.channel;
    return true;
  }
  async function sendStats(
    instanceId: string,
    channel: string,
  ): Promise<boolean> {
    const stats = await getStats();
    const response = await http.send<SecurityObject>({
      path: `/conn/${channel}`,
      method: 'POST',
      data: SecurityService.enc(instanceId, stats),
      headers: {
        iid: instanceId,
      },
    });
    if (response.status !== 200) {
      logger.warn(
        'register',
        `${response.status} - ${(response.data as any).message}`,
      );
      return false;
    }
    const resObj: {
      ok: string;
    } = SecurityService.dec(instanceId, response.data);
    return !!resObj.ok;
  }
}

export const ConnectionService = connectionService();

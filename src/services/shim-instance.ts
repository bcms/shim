import * as crypto from 'crypto';
import type { ShimInstanceService } from '../types';
import { Http } from '../util';

export function createShimInstanceService(): ShimInstanceService {
  let port = 1280;
  const http = new Http();
  const secrets: {
    [instanceId: string]: {
      secret: string;
      port: number;
    };
  } = {};

  const self: ShimInstanceService = {
    createSecret(instanceId) {
      secrets[instanceId] = {
        secret: crypto.randomBytes(32).toString('base64'),
        port: port,
      };
      port++;
      return secrets[instanceId].secret;
    },
    getSecret(instanceId) {
      if (secrets[instanceId]) {
        return secrets[instanceId].secret;
      }
    },
    async checkHealth(instanceId) {
      if (!secrets[instanceId]) {
        return {
          ok: false,
        };
      }
      try {
        const res = await http.send<{
          heepAvailable: number;
          heepUsed: number;
        }>({
          host: {
            name:
              process.env.PROD === 'true'
                ? '172.17.0.1'
                : 'localhost',
            port: '' + secrets[instanceId].port,
          },
          headers: {
            shimcode: secrets[instanceId].secret,
          },
          method: 'POST',
          path: '/api/shim/health',
        });
        if (res.status === 200) {
          return {
            ok: true,
            heepAvailable: res.data.heepAvailable,
            heepUsed: res.data.heepUsed,
          };
        }
        return {
          ok: false,
        };
      } catch (e) {
        return {
          ok: false,
        };
      }
    },
  };
  return self;
}

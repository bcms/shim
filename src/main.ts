import {
  createBodyParserMiddleware,
  createCorsMiddleware,
  createPurpleCheetah,
  createRequestLoggerMiddleware,
  updateLogger,
} from '@becomes/purple-cheetah';
import { createSocket } from '@becomes/purple-cheetah-mod-socket';
import { ShimConfig } from './config';
import {
  CloudController,
  InstanceController,
} from './controllers';
import { createManager } from './manager';
import { SecurityMiddleware } from './middleware';
import { DefaultInstanceProxy } from './proxy';
import {
  createCloudConnectionService,
  createLicenseService,
  createSecurityService,
  Service,
} from './services';
import type { SecurityObject } from './types';
import { CloudSocket } from './util';

async function main() {
  if (ShimConfig.local) {
    // eslint-disable-next-line no-console
    console.warn('DEV', {
      message:
        'Shim is started with LOCAL DEVELOPMENT FLAG.' +
        ' Please do not forget to remove this flag in production.',
    });
  }
  updateLogger({ output: `${process.cwd()}/storage/logs` });
  createPurpleCheetah({
    port: process.env.PORT ? parseInt(process.env.PORT) : 1279,
    controllers: [
      InstanceController,
      CloudController,
    ],
    middleware: [
      createCorsMiddleware(),
      DefaultInstanceProxy,
      createBodyParserMiddleware({ limit: 102400000 }),
      createRequestLoggerMiddleware(),
      SecurityMiddleware,
    ],
    modules: [
      createSecurityService(),
      createLicenseService(),
      createCloudConnectionService(),
      createManager(),
      createSocket({
        path: '/shim/cloud/socket',
        async verifyConnection(socket) {
          try {
            const instanceId = socket.handshake.query
              .instanceId as string;
            const jsonData = JSON.parse(
              Buffer.from(
                socket.handshake.query.data as string,
                'hex',
              ).toString(),
            );
            Service.security.dec<{
              instanceId: string;
            }>(instanceId, jsonData);
          } catch (error) {
            return false;
          }
          return true;
        },
        onConnection(socket) {
          const instanceId = socket.handshake.query
            .instanceId as string;
          const jsonData = JSON.parse(
            Buffer.from(
              socket.handshake.query.data as string,
              'hex',
            ).toString(),
          );
          const data = Service.security.dec<{
            instanceId: string;
          }>(instanceId, jsonData);
          CloudSocket.open(data.instanceId);
          return {
            createdAt: Date.now(),
            id: socket.id,
            scope: `logs_${data.instanceId}`,
            socket,
          };
        },
        eventHandlers: [
          {
            name: 'CLOUD_LOG_REFRESH',
            async handler(a) {
              const event: {
                instanceId: string;
                data: SecurityObject;
              } = a as never;
              try {
                const data = Service.security.dec<{
                  instanceId: string;
                }>(event.instanceId, event.data);
                CloudSocket.refresh(data.instanceId);
              } catch (error) {
                CloudSocket.close(event.instanceId);
              }
            },
          },
        ],
      }),
    ],
  });
}
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});

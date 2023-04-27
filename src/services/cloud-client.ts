import { createHttpClient } from '@becomes/purple-cheetah';
import type { ShimSecurityObject } from '@cloud/shim/models';
import { ShimConfig } from '@shim/config';
import { Service } from './main';

export class CloudClient {
  http = ShimConfig.cloud.domain
    ? createHttpClient({
        host: {
          name: ShimConfig.cloud.domain,
          port: ShimConfig.cloud.port,
        },
        basePath: '/api/v2/shim',
        name: 'Cloud client',
      })
    : createHttpClient({
        host: { name: 'cloud.thebcms.com', port: '443' },
        basePath: '/api/v2/shim',
        name: 'Cloud client',
      });

  async send<ResponsePayload>(config: {
    instanceId: string;
    channel: string;
    path: string;
    payload: unknown;
  }): Promise<ResponsePayload> {
    const response = await this.http.send<ShimSecurityObject>({
      path: `/conn/${config.channel}${config.path}`,
      method: 'post',
      headers: {
        iid: config.instanceId,
      },
      data: Service.security.enc(config.instanceId, config.payload),
    });
    return Service.security.dec(config.instanceId, response.data);
  }
}

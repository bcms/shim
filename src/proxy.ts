import {
  createHTTPError,
  // createHTTPError,
  createMiddleware,
} from '@becomes/purple-cheetah';
import { HTTPStatus } from '@becomes/purple-cheetah/types';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Orchestration } from './orchestration';

export const DefaultInstanceProxy = createMiddleware({
  name: 'Default instance proxy',
  after: false,
  path: '/_instance-proxy',
  handler({ logger }) {
    const errorHandler = createHTTPError({
      logger,
      place: '',
    });

    return createProxyMiddleware('', {
      changeOrigin: true,
      ws: true,
      pathRewrite(path) {
        return path.replace('/_instance-proxy', '');
      },
      router(req) {
        const inst = Orchestration.main.findInstanceByDomainName(
          (req.headers['x-bcms-domain'] as string) || '',
        );
        if (!inst) {
          throw errorHandler.occurred(
            HTTPStatus.BAD_REQUEST,
            `Invalid instance domain "${req.headers['x-bcms-domain']}"`,
          );
        }
        return `http://172.17.0.1:${inst.stats.port}`;
      },
      onError(err, _req, _res) {
        if (err) {
          logger.error('onError', { err });
        }
      },
    });
  },
});

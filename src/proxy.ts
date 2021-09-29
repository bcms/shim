import {
  // createHTTPError,
  createMiddleware,
} from '@becomes/purple-cheetah';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Orchestration } from './orchestration';

export const DefaultInstanceProxy = createMiddleware({
  name: 'Default instance proxy',
  after: false,
  path: '/_instance-proxy',
  handler({ logger }) {
    // const errorHandler = createHTTPError({
    //   logger,
    //   place: '',
    // });

    return createProxyMiddleware('', {
      changeOrigin: true,
      ws: true,
      pathRewrite(path) {
        return path.replace('/_instance-proxy', '');
      },
      router(req) {
        Orchestration.
        return 'http://localhost:81'
      },
      onError(err, _req, _res) {
        if (err) {
          logger.error('onError', { err });
        }
      },
    });
  },
});

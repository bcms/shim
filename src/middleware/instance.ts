import * as crypto from 'crypto';
import type {
  Logger,
  MiddlewarePrototype,
} from '@becomes/purple-cheetah';
import {
  HttpErrorFactory,
  HttpStatus,
  Middleware,
} from '@becomes/purple-cheetah';
import type { NextFunction, Request, Response } from 'express';
import { ShimInstanceService } from '../services';

const blockNonce: Array<{
  expAt: number;
  nonce: string;
  timestamp: number;
}> = [];

setInterval(() => {
  const remove: Array<{
    expAt: number;
    nonce: string;
    timestamp: number;
  }> = [];
  for (let i = 0; i < blockNonce.length; i++) {
    if (blockNonce[i].expAt < Date.now()) {
      remove.push(blockNonce[i]);
    }
  }
  for (let i = 0; i < remove.length; i++) {
    for (let j = 0; j < blockNonce.length; j++) {
      if (
        blockNonce[j].timestamp === remove[i].timestamp &&
        blockNonce[j].nonce === remove[i].nonce
      ) {
        blockNonce.splice(i, 1);
        break;
      }
    }
  }
}, 1000);

@Middleware({
  after: false,
  uri: '/shim/instance',
})
export class ShimInstanceMiddleware implements MiddlewarePrototype {
  after: boolean;
  uri: string;
  logger: Logger;
  handler = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const error = HttpErrorFactory.instance('', this.logger);
    let instanceId = '';
    let nonce = '';
    let timestamp = 0;
    let sig = '';
    if (typeof req.headers['bcms-iid'] !== 'string') {
      next(
        error.occurred(
          HttpStatus.BAD_REQUEST,
          'Missing instance ID.',
        ),
      );
      return;
    } else {
      instanceId = req.headers['bcms-iid'];
    }
    if (typeof req.headers['bcms-nc'] !== 'string') {
      next(error.occurred(HttpStatus.BAD_REQUEST, 'Missing nonce.'));
      return;
    } else {
      nonce = req.headers['bcms-nc'];
    }
    if (typeof req.headers['bcms-ts'] !== 'string') {
      next(
        error.occurred(HttpStatus.BAD_REQUEST, 'Missing timestamp.'),
      );
      return;
    } else {
      timestamp = parseInt(req.headers['bcms-ts']);
      if (
        isNaN(timestamp) ||
        timestamp < Date.now() - 60000 ||
        timestamp > Date.now() + 3000
      ) {
        next(
          error.occurred(
            HttpStatus.BAD_REQUEST,
            'Invalid timestamp.',
          ),
        );
        return;
      }
    }
    if (typeof req.headers['bcms-sig'] !== 'string') {
      next(
        error.occurred(HttpStatus.BAD_REQUEST, 'Missing signature.'),
      );
      return;
    } else {
      sig = req.headers['bcms-sig'];
    }
    if (
      blockNonce.find(
        (e) => e.nonce === nonce && e.timestamp === timestamp,
      )
    ) {
      next(error.occurred(HttpStatus.FORBIDDEN, 'Blocked.'));
      return;
    }
    const instanceSecret = ShimInstanceService.getSecret(instanceId);
    if (!instanceSecret) {
      next(
        error.occurred(
          HttpStatus.FORBIDDEN,
          'Instance not available.',
        ),
      );
      return;
    }
    const checkSig = crypto
      .createHmac('sha256', instanceSecret)
      .update(nonce + timestamp + JSON.stringify(req.body))
      .digest('hex');
    if (process.env.PROD === 'true' && checkSig !== sig) {
      next(
        error.occurred(HttpStatus.UNAUTHORIZED, 'Invalid signature.'),
      );
      return;
    }
    next();
  };
}

import * as crypto from 'crypto';
import type { SecurityObject, SecurityObjectMessage } from '../types';
import { General } from '../util';
import type { Module } from '@becomes/purple-cheetah/types';
import { Service } from './main';

export function createSecurityService(): Module {
  return {
    name: 'Create security service',
    initialize({ next }) {
      const NCS: Array<{
        expAt: number;
        nc: string;
        ts: number;
      }> = [];

      Service.security = {
        letchNonce(nc, ts: number) {
          NCS.push({
            nc,
            ts,
            expAt: ts + 60000,
          });
        },
        isNonceLatched(nc, ts) {
          return !!NCS.find((e) => e.nc === nc && ts === ts);
        },
        enc(instanceId, payload) {
          const license = Service.license.get(instanceId);
          if (!license) {
            throw Error(
              `License for instance "${instanceId}" does not exist.`,
            );
          }
          const obj: SecurityObject = {
            ei: General.randomNumber(0, license.list.length - 1),
            ivi: General.randomNumber(0, license.list.length - 1),
            si: General.randomNumber(0, license.list.length - 1),
            msg: '',
          };
          let encMsg = '';
          const msg: SecurityObjectMessage<unknown> = {
            nc: crypto.randomBytes(8).toString(),
            pl: payload,
            sig: '',
            ts: Date.now(),
          };
          msg.sig = crypto
            .createHmac('sha256', license.list[obj.si].buf)
            .update(msg.nc + msg.ts + JSON.stringify(msg.pl))
            .digest('hex');
          const cipher = crypto.createCipheriv(
            'aes-256-gcm',
            license.list[obj.ei].buf,
            license.list[obj.ivi].buf,
          );
          encMsg = cipher.update(JSON.stringify(msg), 'utf8', 'hex');
          encMsg += cipher.final('hex');
          obj.msg = encMsg;
          cipher.destroy();
          return obj;
        },
        dec<T>(instanceId: string, obj: SecurityObject) {
          const license = Service.license.get(instanceId);
          if (!license) {
            throw Error(
              `License for instance "${instanceId}" does not exist.`,
            );
          }
          let decMsg = '';
          if (
            !license.list[obj.ivi] ||
            !license.list[obj.ei] ||
            !license.list[obj.si]
          ) {
            throw Error('Invalid indexes.');
          }
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            license.list[obj.ei].buf,
            license.list[obj.ivi].buf,
          );
          decMsg = decipher.update(obj.msg, 'hex', 'utf8');
          let msg: SecurityObjectMessage<T>;
          try {
            msg = JSON.parse(decMsg);
          } catch (err) {
            const e = err as Error;
            throw Error(`Message is not an object: ${e.message}`);
          }
          if (!msg.nc) {
            throw Error('Nonce not available.');
          }
          if (
            msg.ts < Date.now() - 60000 ||
            msg.ts > Date.now() + 3000
          ) {
            throw Error('Timestamp out of range.');
          }
          if (Service.security.isNonceLatched(msg.nc, msg.ts)) {
            throw Error('Blocked nonce.');
          }
          const sig = crypto
            .createHmac('sha256', license.list[obj.si].buf)
            .update(msg.nc + msg.ts + JSON.stringify(msg.pl))
            .digest('hex');
          if (sig !== msg.sig) {
            throw Error('Invalid signature.');
          }
          decipher.destroy();
          return msg.pl;
        },
      };

      next();
    },
  };
}

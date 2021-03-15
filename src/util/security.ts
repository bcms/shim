import * as crypto from 'crypto';
import { General } from './general';

export interface SecurityObject {
  /** Encryption index */
  ei: number;
  /** Signature index */
  si: number;
  /** Initial vector index */
  ivi: number;
  msg: string;
}
export interface SecurityObjectMessage<T> {
  /** Message payload */
  pl: T;
  /** Message nonce */
  nc: string;
  /** Message timestamp */
  ts: number;
  /** Message signature */
  sig: string;
}
export interface SecurityPrototype {
  letchNonce(nonce: string, ts: number): void;
  isNonceLatched(nonce: string, ts: number): boolean;
  enc<T>(payload: T): SecurityObject;
  dec<T>(obj: SecurityObject): T;
}

export function Security(
  license?: Array<{
    str: string;
    buf: Buffer;
  }>,
) {
  const NCS: Array<{
    expAt: number;
    nc: string;
    ts: number;
  }> = [];
  setInterval(() => {
    const remove: Array<{ nc: string; ts: number }> = [];
    for (let i = 0; i < NCS.length; i++) {
      if (NCS[i].expAt < Date.now()) {
        remove.push({
          nc: NCS[i].nc,
          ts: NCS[i].ts,
        });
      }
    }
    for (let i = 0; i < remove.length; i++) {
      for (let j = 0; j < NCS.length; j++) {
        if (
          NCS[j].ts === remove[i].ts &&
          NCS[j].nc === remove[i].nc
        ) {
          NCS.splice(j, 1);
          break;
        }
      }
    }
  }, 1000);
  const self: SecurityPrototype = {
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
    enc(payload) {
      const obj: SecurityObject = {
        ei: General.randomNumber(0, license.length - 1),
        ivi: General.randomNumber(0, license.length - 1),
        si: General.randomNumber(0, license.length - 1),
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
        .createHmac('sha256', license[obj.si].buf)
        .update(msg.nc + msg.ts + JSON.stringify(msg.pl))
        .digest('hex');
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        license[obj.ei].buf,
        license[obj.ivi].buf,
      );
      encMsg = cipher.update(JSON.stringify(msg), 'utf8', 'hex');
      encMsg += cipher.final('hex');
      obj.msg = encMsg;
      cipher.destroy();
      return obj;
    },
    dec<T>(obj) {
      let decMsg = '';
      if (!license[obj.ivi] || !license[obj.ei] || !license[obj.si]) {
        throw Error('Invalid indexes.');
      }
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        license[obj.ei].buf,
        license[obj.ivi].buf,
      );
      decMsg = decipher.update(obj.msg, 'hex', 'utf8');
      let msg: SecurityObjectMessage<T>;
      try {
        msg = JSON.parse(decMsg);
      } catch (e) {
        throw Error(`Message is not an object: ${e.message}`);
      }
      if (!msg.nc) {
        throw Error('Nonce not available.');
      }
      if (msg.ts < Date.now() - 60000 || msg.ts > Date.now() + 3000) {
        throw Error('Timestamp out of range.');
      }
      if (self.isNonceLatched(msg.nc, msg.ts)) {
        throw Error('Blocked nonce.');
      }
      const sig = crypto
        .createHmac('sha256', license[obj.si].buf)
        .update(msg.nc + msg.ts + JSON.stringify(msg.pl))
        .digest('hex');
      if (sig !== msg.sig) {
        throw Error('Invalid signature.');
      }
      decipher.destroy();
      return msg.pl;
    },
  };
  return self;
}

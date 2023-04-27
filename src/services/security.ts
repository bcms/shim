import * as crypto from 'crypto';
import type {
  ShimSecurityObject,
  ShimSecurityObjectMessage,
} from '@cloud/shim/models';
import { Service } from './main';
import { General } from '@shim/util';

export class SecurityService {
  private ncs: { [nonce: string]: number } = {};

  constructor() {
    setInterval(() => {
      const keys = Object.keys(this.ncs);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (this.ncs[key] && this.ncs[key] < Date.now()) {
          delete this.ncs[key];
        }
      }
    }, 5000);
  }

  letchNonce(nonce: string, ts: number): void {
    if (!this.ncs[nonce]) {
      this.ncs[nonce] = ts + 60000;
    }
  }

  isNonceLatched(nonce: string): boolean {
    return !!this.ncs[nonce];
  }

  enc<Payload>(
    instanceId: string,
    payload: Payload,
  ): ShimSecurityObject {
    const license = Service.license.get(instanceId);
    if (!license) {
      throw Error(
        `License for instance "${instanceId}" does not exist.`,
      );
    }
    const obj: ShimSecurityObject = {
      iid: instanceId,
      ei: General.randomNumber(0, license.list.length - 1),
      ivi: General.randomNumber(0, license.list.length - 1),
      si: General.randomNumber(0, license.list.length - 1),
      msg: '',
    };
    let encMsg = '';
    const msg: ShimSecurityObjectMessage<unknown> = {
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
  }

  dec<Payload = unknown>(
    instanceId: string,
    obj: ShimSecurityObject,
  ): Payload {
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
    let msg: ShimSecurityObjectMessage<Payload>;
    try {
      msg = JSON.parse(decMsg);
    } catch (err) {
      const e = err as Error;
      throw Error(`Message is not an object: ${e.message}`);
    }
    if (!msg.nc) {
      throw Error('Nonce not available.');
    }
    if (msg.ts < Date.now() - 60000 || msg.ts > Date.now() + 3000) {
      throw Error('Timestamp out of range.');
    }
    if (Service.security.isNonceLatched(msg.nc)) {
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
  }
}

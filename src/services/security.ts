import * as crypto from 'crypto';
import * as path from 'path';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { SecurityObject, SecurityObjectMessage } from '../types';
import { General } from '../util';
import type { Module } from '@becomes/purple-cheetah/types';
import { Service } from './main';
import { Repo } from '../repo';
import { ShimConfig } from '../config';

export function createSecurityService(): Module {
  return {
    name: 'Create security service',
    initialize({ next }) {
      const logger = useLogger({ name: 'Security service' });
      const NCS: Array<{
        expAt: number;
        nc: string;
        ts: number;
      }> = [];
      const fs = useFS();

      Service.security = {
        async init() {
          if (ShimConfig.local) {
            return;
          }
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
          if (
            !(await fs.exist(path.join(process.cwd(), 'licenses')))
          ) {
            throw Error('licenses directory does not exist!');
          }
          const licenseFiles = await fs.readdir(
            path.join(process.cwd(), 'licenses'),
          );
          for (let i = 0; i < licenseFiles.length; i++) {
            if (licenseFiles[i].endsWith('.license')) {
              const instanceId = licenseFiles[i].split('.')[0];
              const licenseRaw = (
                await fs.read(
                  path.join(
                    process.cwd(),
                    'licenses',
                    licenseFiles[i],
                  ),
                )
              ).toString();
              try {
                const res = await Service.cloudConnection.http.send<{
                  ok: boolean;
                }>({
                  path: `/instance/valid/${instanceId}`,
                  method: 'POST',
                });
                if (res.status === 200 && res.data.ok) {
                  Service.license.add(instanceId, licenseRaw);
                }
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);
                logger.error(
                  'init',
                  `Invalid license file ${licenseFiles[i]}`,
                );
              }
            }
          }
          const instIds = Service.license.getInstanceIds();
          for (let i = 0; i < instIds.length; i++) {
            const instId = instIds[i];
            const inst = await Repo.cms.findById(instId);
            Service.cms.createSecret(instId);
            if (!inst) {
              await Repo.cms.add({
                _id: instId,
                createdAt: 0,
                updatedAt: 0,
                ok: false,
                history: [],
                port: await Service.cms.nextPost(),
                secret: Service.cms.getSecret(instId),
                volumes: [],
              });
            }
          }
        },
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
          } catch (e) {
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

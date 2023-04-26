import { createFS } from '@banez/fs';
import { StringUtility } from '@becomes/purple-cheetah';

export interface License {
  list: Array<{
    buf: Buffer;
    str: string;
  }>;
}

export class LicenseService {
  private licenses: {
    [instanceId: string]: License;
  } = {};
  private fs = createFS({
    base: process.cwd(),
  });

  async load() {
    const fileNames = await this.fs.readdir('licenses');
    for (let i = 0; i < fileNames.length; i++) {
      const fileName = fileNames[i];
      if (fileName.endsWith('.license')) {
        const file = await this.fs.readString(['licenses', fileName]);
        const [instanceId] = fileName.split('.');
        const core = StringUtility.textBetween(
          file,
          '---- BEGIN BCMS LICENSE ----\n',
          '\n---- END BCMS LICENSE ----',
        );
        const lines = core.split('\n');
        if (lines.length !== 20) {
          throw Error('Invalid license length.');
        } else {
          
        }
        const tempLicense: License = {
          list: lines.map((line) => {
            return {
              str: line,
              buf: Buffer.from(line, 'base64'),
            };
          })
        }
        try {
          const res = await Service.cloudConnection.http.send<{
            ok: boolean;
          }>({
            path: '/license/verify',
            method: 'POST',
            headers: {
              iid: instId,
            },
            data: {
              timestamp: Date.now(),
            },
          });
          if (res.status === 200 && res.data.ok) {
            add(instId, licenseRaw);
          }
          return { licenseRaw, instId };
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(error);
          logger.error(
            'checkLicense',
            `Invalid license file ${licenseName}`,
          );
        }
      }
    }
  }

  get(instanceId: string): License | null {
    return this.licenses[instanceId] || null;
  }

  getInstanceIds() {
    return Object.keys(this.licenses);
  }

  private checkLicense;
}

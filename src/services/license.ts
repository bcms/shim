import { createFS } from '@banez/fs';
import { Logger, StringUtility } from '@becomes/purple-cheetah';
import { Service } from './main';

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
  private logger = new Logger('LicenseService');

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
          this.logger.error(
            'load',
            `Invalid format for license "${fileName}"`,
          );
          throw Error('Invalid license length.');
        } else {
          const tempLicense: License = {
            list: lines.map((line) => {
              return {
                str: line,
                buf: Buffer.from(line, 'base64'),
              };
            }),
          };
          try {
            const res = await Service.cloudClient.http.send<{
              ok: boolean;
            }>({
              path: '/license/verify',
              method: 'post',
              headers: {
                iid: instanceId,
              },
              data: {
                timestamp: Date.now(),
              },
            });
            if (res.status === 200 && res.data.ok) {
              this.licenses[instanceId] = tempLicense;
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
            this.logger.error(
              'load',
              `Invalid license file ${fileName}`,
            );
          }
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
}

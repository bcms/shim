import { useStringUtility } from '@becomes/purple-cheetah';
import * as childProcess from 'child_process';

export class System {
  private static stringUtil = useStringUtility();

  static async exec(
    cmd: string,
    onChunk?: (chunk: string, type: 'stdout' | 'stderr') => void,
  ): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      const proc = childProcess.exec(cmd);
      let err = '';
      if (onChunk) {
        proc.stdout.on('data', (chunk) => {
          onChunk(chunk, 'stdout');
        });
        proc.stderr.on('data', (chunk) => {
          err += chunk;
          onChunk(chunk, 'stderr');
        });
      }
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(Error(err));
        } else {
          resolve();
        }
      });
    });
  }
  /**
   * In [kB]
   */
  static async memInfo(): Promise<{
    total: number;
    free: number;
    available: number;
  }> {
    let data = '';
    await this.exec('cat /proc/meminfo', (chunk, type) => {
      if (type === 'stdout') {
        data += chunk;
      }
    });
    const totalString = this.stringUtil.textBetween(
      data,
      'MemTotal:',
      ' kB',
    );
    const freeString = this.stringUtil.textBetween(
      data,
      'MemFree:',
      ' kB',
    );
    const availableString = this.stringUtil.textBetween(
      data,
      'MemAvailable:',
      ' kB',
    );
    return {
      total: totalString
        ? parseInt(totalString.replace(/ /g, ''))
        : -1,
      free: freeString ? parseInt(freeString.replace(/ /g, '')) : -1,
      available: availableString
        ? parseInt(availableString.replace(/ /g, ''))
        : -1,
    };
  }
  /**
   * In [kB]
   */
  static async diskInfo(): Promise<{
    total: number;
    available: number;
    used: number;
  }> {
    let data = '';
    await this.exec('df', (chunk, type) => {
      if (type === 'stdout') {
        data += chunk;
      }
    });
    const info = this.stringUtil
      .textBetween(data, 'overlay', '\n')
      .split(' ')
      .filter((e) => e);

    return {
      total: parseInt(info[0], 10),
      used: parseInt(info[1], 10),
      available: parseInt(info[2], 10),
    };
  }
}

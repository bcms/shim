import { ChildProcess } from '@banez/child_process';
import { StringUtility } from '@becomes/purple-cheetah';
import * as os from 'os';
import { getHeapStatistics } from 'v8';

export interface SystemStats {
  cpu: {
    cores: number;
    usage: number;
  };
  ramAvailable: number;
  ramUsed: number;
  diskAvailable: number;
  diskUsed: number;
  heepAvailable: number;
  heepUsed: number;
  lastUpdate: number;
}

export class General {
  static get system() {
    return {
      async stats(): Promise<SystemStats> {
        const heap = getHeapStatistics();
        const mem = await General.system.memInfo();
        const disk = await General.system.diskInfo();
        return {
          cpu: {
            cores: os.cpus().length,
            usage: await General.cpu.usage(),
          },
          ramAvailable: mem.total,
          ramUsed: mem.total - mem.available,
          diskAvailable: disk.total,
          diskUsed: disk.used,
          heepAvailable: heap.heap_size_limit,
          heepUsed: heap.used_heap_size,
          lastUpdate: Date.now(),
        };
      },

      async memInfo(): Promise<{
        total: number;
        free: number;
        available: number;
      }> {
        let data = '';
        await ChildProcess.advancedExec('cat /proc/meminfo', {
          onChunk: (type, chunk) => {
            if (type === 'stdout') {
              data += chunk;
            }
          },
        }).awaiter;
        const totalString = StringUtility.textBetween(
          data,
          'MemTotal:',
          ' kB',
        );
        const freeString = StringUtility.textBetween(
          data,
          'MemFree:',
          ' kB',
        );
        const availableString = StringUtility.textBetween(
          data,
          'MemAvailable:',
          ' kB',
        );
        return {
          total: totalString
            ? parseInt(totalString.replace(/ /g, ''))
            : -1,
          free: freeString
            ? parseInt(freeString.replace(/ /g, ''))
            : -1,
          available: availableString
            ? parseInt(availableString.replace(/ /g, ''))
            : -1,
        };
      },
      /**
       * In [kB]
       */
      async diskInfo(): Promise<{
        total: number;
        available: number;
        used: number;
      }> {
        let data = '';
        await ChildProcess.advancedExec('df', {
          onChunk: (type, chunk) => {
            if (type === 'stdout') {
              data += chunk;
            }
          },
        }).awaiter;
        const info = StringUtility.textBetween(data, 'overlay', '\n')
          .split(' ')
          .filter((e) => e);

        return {
          total: parseInt(info[0], 10),
          used: parseInt(info[1], 10),
          available: parseInt(info[2], 10),
        };
      },
    };
  }

  static get cpu() {
    return {
      average(): { total: number; idle: number } {
        let totalIdle = 0,
          totalTick = 0;
        const cpus = os.cpus();
        for (let i = 0, len = cpus.length; i < len; i++) {
          const cpu = cpus[i];
          for (const type in cpu.times) {
            totalTick += cpu.times[type as never];
          }
          totalIdle += cpu.times.idle;
        }
        return {
          idle: totalIdle / cpus.length,
          total: totalTick / cpus.length,
        };
      },

      async usage(): Promise<number> {
        return new Promise<number>((resolve) => {
          const startMeasure = General.cpu.average();
          setTimeout(() => {
            const endMeasure = General.cpu.average();
            const idleDifference =
              endMeasure.idle - startMeasure.idle;
            const totalDifference =
              endMeasure.total - startMeasure.total;

            resolve(
              100 - ~~((100 * idleDifference) / totalDifference),
            );
          }, 100);
        });
      },
    };
  }

  static randomNumber(min: number, max: number): number {
    const r = Math.random() * (max - min) + min;
    return Math.floor(r);
  }
}

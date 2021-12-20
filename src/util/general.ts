import * as os from 'os';

export const General = {
  string: {
    getTextBetween(src: string, begin: string, end: string): string {
      const startIndex = src.indexOf(begin);
      if (startIndex === -1) {
        return '';
      }
      const endIndex = src.indexOf(end, startIndex + begin.length);
      if (endIndex === -1) {
        return '';
      }
      return src.substring(startIndex + begin.length, endIndex);
    },
    getAllTextBetween(
      src: string,
      begin: string,
      end: string,
    ): string[] {
      const output: string[] = [];
      const index = {
        begin: src.indexOf(begin, 0),
        end: 0,
      };
      if (index.begin === -1) {
        return [];
      }
      index.end = src.indexOf(end, index.begin);
      if (index.end === -1) {
        return [];
      }
      output.push(
        src.substring(index.begin + begin.length, index.end),
      );
      // eslint-disable-next-line no-constant-condition
      while (true) {
        index.begin = src.indexOf(begin, index.end);
        if (index.begin === -1) {
          break;
        }
        index.end = src.indexOf(end, index.begin);
        if (index.end === -1) {
          break;
        }
        output.push(
          src.substring(index.begin + begin.length, index.end),
        );
      }
      return output;
    },
  },
  cpu: {
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
          const idleDifference = endMeasure.idle - startMeasure.idle;
          const totalDifference =
            endMeasure.total - startMeasure.total;

          resolve(100 - ~~((100 * idleDifference) / totalDifference));
        }, 100);
      });
    },
  },
  randomNumber(min: number, max: number): number {
    const r = Math.random() * (max - min) + min;
    return Math.floor(r);
  },
};

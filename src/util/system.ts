import { useStringUtility } from '@becomes/purple-cheetah';
import {
  SpawnOptions,
  spawn,
  exec,
  ExecOptions,
} from 'child_process';

interface SystemExecOutput {
  stop(): void;
  awaiter: Promise<void>;
}

export class System {
  private static stringUtil = useStringUtility();

  static async spawn(
    cmd: string,
    args: string[],
    options?: SpawnOptions,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn(
        cmd,
        args,
        options
          ? options
          : {
              stdio: 'inherit',
            },
      );
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(code);
        } else {
          resolve();
        }
      });
    });
  }
  static exec(
    cmd: string,
    options?: ExecOptions & {
      onChunk?: (type: 'stdout' | 'stderr', chunk: string) => void;
      doNotThrowError?: boolean;
    },
  ): SystemExecOutput {
    const output: SystemExecOutput = {
      stop: undefined as never,
      awaiter: undefined as never,
    };
    output.awaiter = new Promise<void>((resolve, reject) => {
      const proc = exec(cmd, options);
      let err = '';
      output.stop = () => {
        proc.kill();
      };
      if (options && options.onChunk) {
        const onChunk = options.onChunk;
        if (proc.stderr) {
          proc.stderr.on('data', (chunk) => {
            onChunk('stderr', chunk);
            if (options && !options.doNotThrowError) {
              err += chunk;
            }
          });
        }
        if (proc.stdout) {
          proc.stdout.on('data', (chunk) => {
            onChunk('stdout', chunk);
          });
        }
      }
      proc.on('close', (code) => {
        if (options && options.doNotThrowError) {
          resolve();
        } else if (code !== 0) {
          reject(`${code} - ${err}`);
        } else {
          resolve();
        }
      });
    });
    return output;
  }
  static execHelper(exo: {
    out: string;
    err: string;
  }): (type: 'stdout' | 'stderr', chunk: string) => void {
    exo.out = '';
    exo.err = '';
    return (type, chunk) => {
      if (type === 'stdout') {
        exo.out += chunk;
      } else {
        exo.err += chunk;
      }
    };
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
    await this.exec('cat /proc/meminfo', {
      onChunk: (type, chunk) => {
        if (type === 'stdout') {
          data += chunk;
        }
      },
    }).awaiter;
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
    await this.exec('df', {
      onChunk: (type, chunk) => {
        if (type === 'stdout') {
          data += chunk;
        }
      },
    }).awaiter;
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

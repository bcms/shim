import type { Docker, InspectContainerInfo } from '../types';
import { System } from '../util';

export function createDocker(): Docker {
  function execHelper(exo: {
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

  return {
    async inspectContainers() {
      const exo = {
        out: '',
        err: '',
      };
      try {
        await System.exec('docker ps -a', { onChunk: execHelper(exo) })
          .awaiter;
      } catch (error) {
        throw Error(error)
      }
      let lines = exo.out.split('\n');
      const headerIndexes = [0];
      const rows: string[][] = [];
      {
        const header = lines[0];
        let takeNext = false;
        for (let i = 0; i < header.length; i++) {
          if (
            takeNext &&
            header.charAt(i) !== ' ' &&
            header.charAt(i) !== '\n'
          ) {
            headerIndexes.push(i);
            takeNext = false;
          } else if (
            !takeNext &&
            ((header.charAt(i) === ' ' &&
              header.charAt(i + 1) === ' ') ||
              i === header.length - 1)
          ) {
            takeNext = true;
          }
        }
        lines = lines.slice(1);
      }
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line) {
          const rowIndex = rows.push([]) - 1;
          for (let j = 0; j < headerIndexes.length; j++) {
            const startIndex = headerIndexes[j];
            let endIndex = line.indexOf('  ', startIndex);
            if (endIndex === -1 && j > 0) {
              endIndex = line.length;
            }
            rows[rowIndex].push(line.substring(startIndex, endIndex));
          }
          if (!rows[rowIndex][6].startsWith('bcms-instance-')) {
            rows.pop();
          }
        }
      }

      const instInfos: InspectContainerInfo[] = [];
      for (let i = 0; i < rows.length; i++) {
        const cols = rows[i];
        const name = cols[6];
        const id = name.split('-')[2];
        let port = '';
        await System.exec(`docker inspect ${name}`, {
          onChunk: execHelper(exo),
          doNotThrowError: true,
        }).awaiter;
        if (!exo.err && exo.out.startsWith('[')) {
          const data = JSON.parse(exo.out)[0];
          if (data) {
            const ports = data.NetworkSettings.Ports;
            for (const key in ports) {
              if (ports[key]) {
                port = ports[key][0].HostPort;
              }
            }
          }
        } else {
          throw Error(`Failed to inspect "${name}". ${exo.err}`);
        }
        instInfos.push({
          id,
          name,
          ip: '172.17.0.1',
          up: cols[4].startsWith('Up'),
          port,
        });
      }

      return instInfos;
    },
  };
}

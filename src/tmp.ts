import { System } from './util';

async function main() {
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
  const exo = {
    out: '',
    err: '',
  };
  await System.exec('docker ps -a', { onChunk: execHelper(exo) })
    .awaiter;
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
        ((header.charAt(i) === ' ' && header.charAt(i + 1) === ' ') ||
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
      if (!rows[rowIndex][6].startsWith('bcms-')) {
        rows.pop();
      }
    }
  }
  const instInfos: Array<{
    name: string;
    ip: string;
    port: string;
    up: boolean;
  }> = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
  }

  console.log(rows);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});

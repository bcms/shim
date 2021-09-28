import { useFS } from '@becomes/purple-cheetah';
import type { Nginx, NginxConfig, NginxDomain } from '../types';
import { System } from '../util';

export async function createNginx({
  domains,
}: NginxConfig): Promise<Nginx> {
  const fs = useFS();

  async function createConfigFile() {
    // TODO
  }

  const self: Nginx = {
    domains: {},
    async addDomain(domain) {
      if (!domains[domain.name]) {
        self.domains[domain.name] = domain;
        await createConfigFile();
      }
    },
    async removeDomain(name) {
      if (self.domains[name]) {
        delete self.domains[name];
      }
    },
    async restart() {
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(
        ['docker', 'stop', 'bcms-proxy'].join(' '),
        { onChunk: execHelper(exo), doNotThrowError: true },
      ).awaiter;
      if (exo.err) {
        logger.error('remove', {
          msg: `Failed to stop container "${containerName}"`,
          exo,
        });
      } else {
        logger.info(
          'remove',
          `Container "${containerName}" stopped.`,
        );
      }
    }
  };

  for (let i = 0; i < domains.length; i++) {
    const d = domains[i];
    self.domains[d.name] = d;
  }

  return self;
}

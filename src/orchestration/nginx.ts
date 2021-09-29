import {
  useFS,
  useLogger,
  useStringUtility,
} from '@becomes/purple-cheetah';
import { ShimConfig } from '../config';
import type { Nginx, NginxConfig } from '../types';
import { System } from '../util';

const instanceConfigHttp = `
server {
  listen 80;
  listen [::]:80;
  server_name @domain;

  client_max_body_size 105M;

  location /api/socket/server {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_pass http://172.17.0.1:@port/api/socket/server/;
  }
  location /api {
    proxy_set_header bcmsrip $remote_addr ;
    proxy_pass http://172.17.0.1:@port/api;
  }
  location /sockjs-node {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_pass http://172.17.0.1:@port/sockjs-node;
  }
  location / {
    proxy_set_header bcmsrip $remote_addr ;
    proxy_pass http://172.17.0.1:@port/;
  }
}
`;

const instanceConfigHttps = `
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name @domain;

  client_max_body_size 105M;

  access_log /var/log/nginx/s.vajagic-law.com-access.log;
  error_log /var/log/nginx/s.vajagic-law.com-error.log;

  ssl_certificate         /etc/nginx/ssl/@domain/crt;
  ssl_certificate_key     /etc/nginx/ssl/@domain/key;
  ssl_ciphers             EECDH+ECDSA+AESGCM:EECDH+aRSA+AESGCM:EECDH+ECDSA+SHA384:EECDH+ECDSA+SHA256:EECDH+aRSA+SHA384:EECDH+aRSA+SHA256:EECDH+aRSA+RC4:EECDH:EDH+aRSA:RC4:!aNULL:!eNULL:!LOW:!3DES:!MD5:!EXP:!PSK:!SRP:!DSS;
  ssl_protocols           TLSv1.2 TLSv1.3;

  location /api/socket/server {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_pass http://172.17.0.1:@port/api/socket/server/;
  }
  location /api {
    proxy_set_header bcmsrip $remote_addr ;
    proxy_pass http://172.17.0.1:@port/api;
  }
  location /sockjs-node {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    proxy_pass http://172.17.0.1:@port/sockjs-node;
  }
  location / {
    proxy_set_header bcmsrip $remote_addr ;
    proxy_pass http://172.17.0.1:@port/;
  }
}
`;

function getInstanceConfigHttps({
  domain,
  port,
}: {
  domain: string;
  port: string;
}): string {
  return instanceConfigHttps
    .replace(/@domain/g, domain)
    .replace(/@port/g, port);
}
function getInstanceConfigHttp({
  domain,
  port,
}: {
  domain: string;
  port: string;
}): string {
  return instanceConfigHttp
    .replace(/@domain/g, domain)
    .replace(/@port/g, port);
}

export async function createNginx({
  orch,
}: NginxConfig): Promise<Nginx> {
  const logger = useLogger({ name: 'Nginx' });
  const fs = useFS();
  const stringUtil = useStringUtility();

  const containerName = 'bcms-proxy';
  const nginxConfigFile = (await fs.read('proxy/nginx.conf'))
    .toString()
    .replace(/:1282/g, process.env.PORT || '1279');
  const nginxConfigInstChunk = stringUtil.textBetween(
    nginxConfigFile,
    '# ---- INSTANCES START ---',
    '# ---- INSTANCES END ----',
  );

  async function updateConfig() {
    const servers: string[] = [];
    await fs.deleteDir('proxy/ssl');
    const insts = orch.listInstances();
    for (let i = 0; i < insts.length; i++) {
      const inst = insts[i];
      for (let j = 0; j < inst.domains.length; j++) {
        const domain = inst.domains[j];
        if (!domain.name.endsWith('yourbcms.com')) {
          if (domain.ssl) {
            await fs.save(
              `proxy/ssl/${domain.name}/crt`,
              domain.ssl.crt,
            );
            await fs.save(
              `proxy/ssl/${domain.name}/key`,
              domain.ssl.key,
            );
            await System.spawn('chmod', [
              '600',
              '`proxy/ssl/${domain.name}/key`',
            ]);
            servers.push(
              getInstanceConfigHttps({
                domain: domain.name,
                port: inst.port,
              }),
            );
          } else {
            servers.push(
              getInstanceConfigHttp({
                domain: domain.name,
                port: inst.port,
              }),
            );
          }
        }
      }
    }

    const config = nginxConfigFile.replace(
      nginxConfigInstChunk,
      servers.join('\n'),
    );
    await fs.save('nginx.conf', config);
  }

  const self: Nginx = {
    async stop() {
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(['docker', 'stop', containerName].join(' '), {
        onChunk: System.execHelper(exo),
        doNotThrowError: true,
      }).awaiter;
      if (exo.err) {
        logger.error('stop', {
          msg: `Failed to stop container`,
          exo,
        });
      } else {
        logger.info('stop', `Container stopped.`);
      }
    },
    async start() {
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(
        ['docker', 'start', containerName].join(' '),
        {
          onChunk: System.execHelper(exo),
          doNotThrowError: true,
        },
      ).awaiter;
      if (exo.err) {
        logger.error('start', {
          msg: `Failed to stop container`,
          exo,
        });
      } else {
        logger.info('start', `Container stopped.`);
      }
    },
    async restart() {
      await self.stop();
      await self.start();
    },
    async remove() {
      await self.stop();
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(['docker', 'rm', containerName].join(' '), {
        onChunk: System.execHelper(exo),
        doNotThrowError: true,
      }).awaiter;
      if (exo.err) {
        logger.error('remove', {
          msg: `Failed to remove container`,
          exo,
        });
      } else {
        logger.info('remove', `Container removed.`);
      }
      await System.exec(['docker', 'rmi', containerName].join(' '), {
        onChunk: System.execHelper(exo),
        doNotThrowError: true,
      }).awaiter;
      if (exo.err) {
        logger.error('remove', {
          msg: `Failed to remove image`,
          exo,
        });
      } else {
        logger.info('remove', `Image removed.`);
      }
    },
    async run() {
      await updateConfig();
      await self.remove();
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(
        ['docker', 'build', 'proxy', '-t', containerName].join(' '),
        {
          onChunk: System.execHelper(exo),
          doNotThrowError: true,
        },
      ).awaiter;
      if (exo.err) {
        logger.error('run', {
          msg: `Failed to build the image`,
          exo,
        });
        return;
      } else {
        logger.info('run', `Image created.`);
      }
      await System.exec(
        [
          'docker',
          'run',
          '-d',
          '-p',
          `${ShimConfig.portRange.from}-${ShimConfig.portRange.to}:${ShimConfig.portRange.from}-${ShimConfig.portRange.to}`,
          '-p',
          '3000:1279',
          '-v',
          `${process.cwd()}/proxy/ssl:/etc/nginx/ssl`,
          '--name',
          containerName,
          containerName,
        ].join(' '),
        {
          onChunk: System.execHelper(exo),
          doNotThrowError: true,
        },
      ).awaiter;
      if (exo.err) {
        logger.error('run', {
          msg: `Failed to run the container`,
          exo,
        });
        return;
      } else {
        logger.info('run', `Container started.`);
      }
    },
  };

  return self;
}

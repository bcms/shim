import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Nginx, NginxConfig } from '../types';
import { System } from '../util';

const nConfig = `
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
  worker_connections 768;
}

http {
  sendfile on;
  tcp_nopush on;
  tcp_nodelay on;
  keepalive_timeout 65;
  types_hash_max_size 2048;
  server_tokens off;

  include /etc/nginx/mime.types;
  default_type application/octet-stream;

  ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3; # Dropping SSLv3, ref: POODLE
  ssl_prefer_server_ciphers on;

  access_log /var/log/nginx/access.log;
  error_log /var/log/nginx/error.log;

  include /etc/nginx/conf.d/*.conf;
  include /etc/nginx/sites-enabled/*;

  server {
    listen 80;
    listen [::]:80;
    server_name _;

    client_max_body_size 105M;

    location /_instance-proxy/api/socket/server {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;

      proxy_pass http://172.17.0.1:1279/_instance-proxyapi/socket/server/;
    }
    location /_instance-proxy {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://172.17.0.1:1279/_instance-proxy;
    }
  }

  @instanceServers

  ########
  # Shim #
  ########
  server {
    listen 3000;
    listen [::]:3000;
    server_name _;

    client_max_body_size 105M;

    location / {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://172.17.0.1:1279/;
    }
  }
}
`;
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
  const fs = useFS({
    base: `${process.cwd()}`
  });

  const containerName = 'bcms-proxy';
  let configBuffer = '';
  let lastConfig = '';

  setTimeout(async () => {
    if (configBuffer !== lastConfig) {
      configBuffer = lastConfig + '';
      await self.copyConfigToContainer();
      await self.restart();
    }
  }, 5000);

  const self: Nginx = {
    async updateConfig() {
      const servers: string[] = [];
      if (await fs.exist('proxy/ssl')) {
        await fs.deleteDir('proxy/ssl');
      }
      const insts = orch.listInstances();
      for (let i = 0; i < insts.length; i++) {
        const inst = insts[i];
        for (let j = 0; j < inst.data.domains.length; j++) {
          const domain = inst.data.domains[j];
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
                  port: inst.stats.port,
                }),
              );
            } else {
              servers.push(
                getInstanceConfigHttp({
                  domain: domain.name,
                  port: inst.stats.port,
                }),
              );
            }
          }
        }
      }

      lastConfig = nConfig.replace(
        '@instanceServers',
        servers.join('\n'),
      );
      await fs.save(`proxy/nginx.conf`, lastConfig);
    },
    async copyConfigToContainer() {
      const exo = {
        out: '',
        err: '',
      };
      await System.exec(
        [
          'docker',
          'cp',
          `proxy/nginx.conf`,
          `${containerName}:/etc/nginx/nginx.conf`,
        ].join(' '),
        {
          onChunk: System.execHelper(exo),
          doNotThrowError: true,
        },
      ).awaiter;
      if (exo.err) {
        logger.error('copyConfigToContainer', {
          msg: `Failed to copy config to the container`,
          exo,
        });
        return false;
      } else {
        logger.info(
          'copyConfigToContainer',
          `Config copied to the container.`,
        );
        return true;
      }
    },
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
        return false;
      } else {
        logger.info('stop', `Container stopped.`);
        return true;
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
          msg: `Failed to start container`,
          exo,
        });
        return false;
      } else {
        logger.info('start', `Container started.`);
        return true;
      }
    },
    async restart() {
      await self.stop();
      return await self.start();
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
        return false;
      } else {
        logger.info('remove', `Image removed.`);
        return true;
      }
    },
    async run() {
      await self.updateConfig();
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
          `80:80`,
          '-p',
          '3000:3000',
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
        return false;
      } else {
        logger.info('run', `Container started.`);
        return true;
      }
    },
  };

  return self;
}

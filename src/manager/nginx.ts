import * as path from 'path';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Nginx, NginxConfig } from '../types';
import { ChildProcess } from '@banez/child_process';
import type { ChildProcessOnChunkHelperOutput } from '@banez/child_process/types';
import { Docker } from '@banez/docker';
import type {
  DockerArgs,
  DockerContainerInfo,
} from '@banez/docker/types';
import { ShimConfig } from '../config';

const nConfig = {
  main: `
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

      @rootProxies

      location / {
        return 400 "Invalid arguments or invalid domain.";
        add_header Content-Type text/plain always;
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
        proxy_pass http://@bcms-shim-ip:1279/;
      }
      location /_instance-proxy/api/socket/server {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
  
        proxy_pass http://@bcms-shim-ip:1279/_instance-proxy/api/socket/server/;
      }
    }
  }
  `,
  http: `
  server {  
    listen 80;
    listen [::]:80;
    server_name @domain;

    access_log /var/log/nginx/@domain-access.log;
    error_log /var/log/nginx/@domain-error.log;

    client_max_body_size 100M;

    location /api/socket/server {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;

      proxy_pass http://@bcms-instance-ip:8080/api/socket/server/;
    }
    location /api {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://@bcms-instance-ip:8080/api;
    }
    location /sockjs-node {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;

      proxy_pass http://@bcms-instance-ip:8080/sockjs-node;
    }
    location / {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://@bcms-instance-ip:8080/;
    }
  }
  `,
  https: `
  server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name @domain;

    access_log /var/log/nginx/@domain-ssl-access.log;
    error_log /var/log/nginx/@domain-ssl-error.log;

    client_max_body_size 100M;

    ssl_certificate         /etc/nginx/ssl/@domain/crt;
    ssl_certificate_key     /etc/nginx/ssl/@domain/key;
    ssl_ciphers             EECDH+ECDSA+AESGCM:EECDH+aRSA+AESGCM:EECDH+ECDSA+SHA384:EECDH+ECDSA+SHA256:EECDH+aRSA+SHA384:EECDH+aRSA+SHA256:EECDH+aRSA+RC4:EECDH:EDH+aRSA:RC4:!aNULL:!eNULL:!LOW:!3DES:!MD5:!EXP:!PSK:!SRP:!DSS;
    ssl_protocols           TLSv1.2 TLSv1.3;

    location /api/socket/server {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;

      proxy_pass http://@bcms-instance-ip:8080/api/socket/server/;
    }
    location /api {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://@bcms-instance-ip:8080/api;
    }
    location /sockjs-node {
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;

      proxy_pass http://@bcms-instance-ip:8080/sockjs-node;
    }
    location / {
      proxy_set_header bcmsrip $remote_addr ;
      proxy_pass http://@bcms-instance-ip:8080/;
    }
  }
  `,
};

function getConfig(data: {
  type: 'http' | 'https';
  domain: string;
  ip: string;
}): string {
  return nConfig[data.type]
    .replace(/@domain/g, data.domain)
    .replace(/@bcms-instance-ip/g, data.ip);
}

export function createNginx({ manager }: NginxConfig): Nginx {
  const logger = useLogger({ name: 'Nginx' });
  const fs = useFS({
    base: path.join(process.cwd(), 'proxy'),
  });
  const name = 'bcms-proxy';
  let config = '';

  const self: Nginx = {
    async updateConfig() {
      const servers: string[] = [];
      if (await fs.exist('proxy/ssl')) {
        await fs.deleteDir('proxy/ssl');
      }
      const containers = manager.container.findAll();
      const rootProxies = '';
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        await container.updateInfo();
        for (let j = 0; j < container.data.domains.length; j++) {
          const domain = container.data.domains[j];
          if (domain.name.endsWith('yourbcms.com')) {
            servers.push(
              getConfig({
                domain: domain.name,
                ip:
                  container.info &&
                  container.info.NetworkSettings.Networks.bcms &&
                  container.info.NetworkSettings.Networks.bcms
                    .IPAddress
                    ? container.info.NetworkSettings.Networks.bcms
                        .IPAddress
                    : '10.20.30.1',
                type: 'http',
              }),
            );
          } else {
            if (domain.ssl && domain.ssl.crt && domain.ssl.key) {
              await fs.save(
                ['ssl', domain.name, 'crt'],
                domain.ssl.crt,
              );
              await fs.save(
                ['ssl', domain.name, 'key'],
                domain.ssl.key,
              );
              await ChildProcess.spawn('chmod', [
                '600',
                `proxy/ssl/${domain.name}/key`,
              ]);
              servers.push(
                getConfig({
                  domain: domain.name,
                  ip:
                    container.info &&
                    container.info.NetworkSettings.Networks.bcms &&
                    container.info.NetworkSettings.Networks.bcms
                      .IPAddress
                      ? container.info.NetworkSettings.Networks.bcms
                          .IPAddress
                      : '10.20.30.1',
                  type: 'https',
                }),
              );
            } else {
              servers.push(
                getConfig({
                  domain: domain.name,
                  ip:
                    container.info &&
                    container.info.NetworkSettings.Networks.bcms &&
                    container.info.NetworkSettings.Networks.bcms
                      .IPAddress
                      ? container.info.NetworkSettings.Networks.bcms
                          .IPAddress
                      : '10.20.30.1',
                  type: 'http',
                }),
              );
            }
          }
          //   const domainHash = Buffer.from(domain.name).toString(
          //     'hex',
          //   );
          //   if (!container.info || !container.info?.NetworkSettings) {
          //     logger.warn('', container.info);
          //   }
          //   const ip =
          //     container.info &&
          //     container.info.NetworkSettings.Networks.bcms &&
          //     container.info.NetworkSettings.Networks.bcms.IPAddress
          //       ? container.info.NetworkSettings.Networks.bcms
          //           .IPAddress
          //       : '10.20.30.1';
          //   rootProxies += `
          //   # ${container.name}
          //   location /${domainHash}/api/socket/server {
          //     proxy_http_version 1.1;
          //     proxy_set_header Upgrade $http_upgrade;
          //     proxy_set_header Connection "upgrade";
          //     proxy_set_header Host $host;

          //     proxy_pass http://${ip}:8080/api/socket/server/;
          //   }
          //   location /${domainHash}/api {
          //     proxy_set_header bcmsrip $remote_addr ;
          //     proxy_pass http://${ip}:8080/api;
          //   }
          //   location /${domainHash}/sockjs-node {
          //     proxy_http_version 1.1;
          //     proxy_set_header Upgrade $http_upgrade;
          //     proxy_set_header Connection "upgrade";
          //     proxy_set_header Host $host;

          //     proxy_pass http://${ip}:8080/sockjs-node;
          //   }
          //   location /${domainHash}/ {
          //     proxy_set_header bcmsrip $remote_addr ;
          //     proxy_pass http://${ip}:8080/;
          //   }
          //   `;
          // }
        }
      }
      let info: DockerContainerInfo | undefined;
      try {
        info = await Docker.container.info(ShimConfig.containerName);
      } catch (error) {
        info = undefined;
      }
      config = nConfig.main
        .replace(/@rootProxies/g, rootProxies)
        .replace(/@instanceServers/g, servers.join('\n'))
        .replace(
          /@bcms-shim-ip/g,
          info && info.NetworkSettings.Networks.bcms
            ? info.NetworkSettings.Networks.bcms.IPAddress
            : '10.20.30.1',
        );
      await fs.save(`nginx.conf`, config);
    },
    async copyConfigToContainer() {
      const exo: ChildProcessOnChunkHelperOutput = {
        err: '',
        out: '',
      };
      await ChildProcess.advancedExec(
        [
          'docker',
          'cp',
          `proxy/nginx.conf`,
          `${name}:/etc/nginx/nginx.conf`,
        ],
        {
          onChunk: ChildProcess.onChunkHelper(exo),
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
      }
      exo.err = '';
      exo.out = '';
      await self.restart({
        onChunk: ChildProcess.onChunkHelper(exo),
        doNotThrowError: true,
      });
      if (exo.err) {
        logger.error('copyConfigToContainer', {
          msg: 'Failed to restart Nginx container.',
          exo,
        });
        return false;
      }
      return true;
    },
    async start(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.start(name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('start', {
            msg: 'Failed to start bcms-proxy',
          });
        }
        return exo;
      }
      await Docker.container.start(name, options);
    },
    async stop(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.stop(name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('stop', {
            msg: 'Failed to stop bcms-proxy',
          });
        }
        return exo;
      }
      await Docker.container.stop(name, options);
    },
    async remove(options) {
      if (await Docker.container.exists(name)) {
        let info: DockerContainerInfo | undefined;
        try {
          info = await Docker.container.info(name);
        } catch (error) {
          info = undefined;
        }
        if (info && info.State && info.State.Running) {
          const exo: ChildProcessOnChunkHelperOutput = {
            err: '',
            out: '',
          };
          await Docker.container.stop(name, {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          });
          logger.info('remove - stop', exo);
        }
        if (!options) {
          const exo: ChildProcessOnChunkHelperOutput = {
            err: '',
            out: '',
          };
          await Docker.container.start(name, {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          });
          if (exo.err) {
            logger.error('remove', {
              msg: 'Failed to remove bcms-proxy',
            });
          }
          return exo;
        }
        await Docker.container.remove(name, options);
      }
    },
    async restart(options) {
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.restart(name, {
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('restart', {
            msg: 'Failed to restart bcms-proxy',
          });
        }
        return exo;
      }
      await Docker.container.restart(name, options);
    },
    async build(options) {
      if (await Docker.container.exists(name)) {
        await Docker.container.stop(name);
        await Docker.container.remove(name);
        await Docker.image.remove(name);
      }

      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await ChildProcess.advancedExec(
          ['docker', 'build', 'proxy', '-t', name],
          {
            doNotThrowError: true,
            onChunk: ChildProcess.onChunkHelper(exo),
          },
        ).awaiter;
        if (exo.err) {
          logger.error('build', {
            msg: 'Failed to build bcms-proxy',
          });
        }
        return exo;
      }
      await ChildProcess.advancedExec(
        ['docker', 'build', 'proxy', '-t', name],
        options,
      ).awaiter;
    },
    async run(options) {
      {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await self.remove({
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
      }
      const args: DockerArgs = {
        '-d': [],
        '-p': ['80:80', '443:443', '3000:3000'],
        '-v': `${path.join(
          process.cwd(),
          'proxy',
          'ssl',
        )}:/etc/nginx/ssl`,
        '--network': 'bcms',
        '--name': name,
        '--hostname': name,
      };
      args[name] = [];
      if (!options) {
        const exo: ChildProcessOnChunkHelperOutput = {
          err: '',
          out: '',
        };
        await Docker.container.run({
          args,
          doNotThrowError: true,
          onChunk: ChildProcess.onChunkHelper(exo),
        });
        if (exo.err) {
          logger.error('run', {
            msg: `Failed to run ${name}`,
            exo,
          });
        }
        return exo;
      }
      await Docker.container.run({
        args,
        onChunk: options ? options.onChunk : undefined,
        doNotThrowError: options
          ? options.doNotThrowError
          : undefined,
      });
    },
  };

  return self;
}

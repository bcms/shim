import { Logger } from '@becomes/purple-cheetah';

export class Nginx {
  private logger = new Logger('Nginx');

  private static mainConfig({
    rootProxies,
    instanceServers,
    shimIp,
  }: {
    rootProxies: string;
    instanceServers: string;
    shimIp: string;
  }) {
    return `
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
  
        ${rootProxies}
  
        location / {
          return 400 "Invalid arguments or invalid domain.";
          add_header Content-Type text/plain always;
        }
      }
  
      ${instanceServers}
  
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
          proxy_pass http://${shimIp}:1279/;
        }
        location /_instance-proxy/api/socket/server {
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
    
          proxy_pass http://${shimIp}:1279/_instance-proxy/api/socket/server/;
        }
      }
    }
    `;
  }

  private static httpConfig({
    domain,
    config,
    instanceIp,
  }: {
    domain: string;
    config: string;
    instanceIp: string;
  }) {
    return `
    server {  
      listen 80;
      listen [::]:80;
      server_name ${domain};
  
      access_log /var/log/nginx/${domain}-access.log;
      error_log /var/log/nginx/${domain}-error.log;
  
      client_max_body_size 100M;
  
      gzip              on;
      gzip_buffers      16 8k;
      gzip_comp_level   4;
      gzip_http_version 1.0;
      gzip_min_length   1280;
      gzip_types        text/plain text/css application/x-javascript text/xml application/xml application/xml+rss text/javascript image/x-icon image/bmp;
      gzip_vary         on;
  
      add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' *.thebcms.com blob: data:;";
      add_header X-Frame-Options "SAMEORIGIN";
      add_header X-Content-Type-Options nosniff;
      add_header Referrer-Policy "no-referrer";
  
      ${config}
  
      location /api/socket/server {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
  
        proxy_pass http://${instanceIp}:8080/api/socket/server/;
      }
      location /api {
        proxy_set_header bcmsrip $remote_addr ;
        proxy_pass http://${instanceIp}:8080/api;
      }
      location / {
        proxy_set_header bcmsrip $remote_addr ;
        proxy_pass http://${instanceIp}:8080/;
      }
    }
    `;
  }

  private static httpsConfig({
    domain,
    instanceIp,
    config,
  }: {
    domain: string;
    instanceIp: string;
    config: string;
  }) {
    return `
      server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;
        server_name ${domain};
    
        access_log /var/log/nginx/${domain}-ssl-access.log;
        error_log /var/log/nginx/${domain}-ssl-error.log;
    
        client_max_body_size 100M;
    
        ssl_certificate         /etc/nginx/ssl/${domain}/crt;
        ssl_certificate_key     /etc/nginx/ssl/${domain}/key;
        ssl_ciphers             EECDH+ECDSA+AESGCM:EECDH+aRSA+AESGCM:EECDH+ECDSA+SHA384:EECDH+ECDSA+SHA256:EECDH+aRSA+SHA384:EECDH+aRSA+SHA256:EECDH+aRSA+RC4:EECDH:EDH+aRSA:RC4:!aNULL:!eNULL:!LOW:!3DES:!MD5:!EXP:!PSK:!SRP:!DSS;
        ssl_protocols           TLSv1.2 TLSv1.3;
    
        gzip              on;
        gzip_buffers      16 8k;
        gzip_comp_level   4;
        gzip_http_version 1.0;
        gzip_min_length   1280;
        gzip_types        text/plain text/css application/x-javascript text/xml application/xml application/xml+rss text/javascript image/x-icon image/bmp;
        gzip_vary         on;
    
        add_header Content-Security-Policy "default-src 'self' 'unsafe-inline' *.thebcms.com blob: data:;";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options nosniff;
        add_header Referrer-Policy "no-referrer";
    
        ${config}
    
        location /api/socket/server {
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection "upgrade";
          proxy_set_header Host $host;
    
          proxy_pass http://${instanceIp}:8080/api/socket/server/;
        }
        location /api {
          proxy_set_header bcmsrip $remote_addr ;
          proxy_pass http://${instanceIp}:8080/api;
        }
        location / {
          proxy_set_header bcmsrip $remote_addr ;
          proxy_pass http://${instanceIp}:8080/;
        }
      }
      `;
  }
}

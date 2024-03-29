import * as http from 'http';
import * as https from 'https';

export interface HttpConfig {
  host?: {
    name: string;
    port?: string;
  };
  path: string;
  method: 'POST';
  headers?: { [key: string]: string };
  data?: unknown;
}
export interface HttpResponse<T> {
  status: number;
  data: T;
  headers: http.IncomingHttpHeaders;
}
export interface HttpResponseError {
  status: number;
  headers: http.IncomingHttpHeaders;
  data: unknown;
  err: Error | http.IncomingMessage;
}

export class Http {
  constructor(
    private host?: string,
    private port?: string,
    private basePath?: string,
  ) {}

  setHost(host: { name?: string; port?: string }): void {
    this.host = host.name;
    this.port = host.port;
  }
  setBasePath(basePath?: string): void {
    this.basePath = basePath;
  }
  async send<T>(config: HttpConfig): Promise<HttpResponse<T>> {
    return new Promise<HttpResponse<T>>((resolve, reject) => {
      const requestConfig: http.RequestOptions = {
        host: config.host ? config.host.name : this.host,
        port:
          config.host && config.host.port
            ? config.host.port
            : this.port,
        path: this.basePath
          ? `${this.basePath}${config.path}`
          : config.path,
        method: config.method,
        headers: config.headers ? config.headers : {},
      };
      let data = '';
      if (typeof config.data === 'object') {
        data = JSON.stringify(config.data);
        (requestConfig.headers as http.OutgoingHttpHeaders)[
          'content-type'
        ] = 'application/json';
      } else if (typeof config.data !== 'undefined') {
        data = `${config.data}`;
        (requestConfig.headers as http.OutgoingHttpHeaders)[
          'content-type'
        ] = 'text/plain';
      }
      const sender =
        config.host && config.host.port
          ? config.host.port === '443'
            ? https
            : http
          : this.port === '443'
          ? https
          : http;
      const request = sender.request(requestConfig, (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('error', (err) => {
          const output: HttpResponseError = {
            status: res.statusCode || 500,
            err,
            headers: res.headers,
            data:
              res.headers['content-type'] === 'application/json'
                ? JSON.parse(rawData)
                : rawData,
          };
          reject(output);
          return;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            const output: HttpResponseError = {
              status: res.statusCode || 500,
              err: res,
              headers: res.headers,
              data:
                res.headers['content-type'] === 'application/json'
                  ? JSON.parse(rawData)
                  : rawData,
            };
            reject(output);
            return;
          }
          const contentType = (
            res.headers as http.IncomingHttpHeaders
          )['content-type'];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: contentType
              ? contentType.indexOf('application/json') !== -1
                ? JSON.parse(rawData)
                : rawData
              : rawData,
          });
        });
      });
      request.on('error', (e) => {
        reject(e);
      });
      if (typeof data !== 'undefined') {
        request.write(data);
      }
      request.end();
    });
  }
}

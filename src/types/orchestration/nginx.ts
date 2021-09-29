import type { Orchestration } from '.';

export interface NginxConfig {
  orch: Orchestration;
  domains: NginxDomain[];
}

export interface NginxDomain {
  instId: string;
  name: string;
  ssl?: {
    crt: string;
    key: string;
  };
}

export interface Nginx {
  domains: {
    [instId: string]: { [domainName: string]: NginxDomain };
  };
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  run(): Promise<void>;
  remove(): Promise<void>;
  addDomain(data: {
    instId: string;
    domain: NginxDomain;
  }): Promise<void>;
  removeDomain(data: { instId: string; name: string }): Promise<void>;
}

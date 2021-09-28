export interface NginxConfig {
  domains: NginxDomain[];
}

export interface NginxDomain {
  name: string;
  ssl?: {
    crt: string;
    key: string;
  };
}

export interface Nginx {
  domains: {
    [name: string]: NginxDomain;
  };
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  addDomain(domain: NginxDomain): Promise<void>;
  removeDomain(name: string): Promise<void>;
}

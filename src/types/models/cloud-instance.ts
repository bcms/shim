export type CloudInstanceStatus =
  | 'active'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown'
  | 'restarting';

export interface CloudInstanceDomain {
  name: string;
  ssl?: {
    key: string;
    crt: string;
  };
}

export interface CloudInstanceStats {
  id: string;
  name: string;
  ip: string;
  port: string;
  status: CloudInstanceStatus;
  previousStatus: CloudInstanceStatus;
}

// eslint-disable-next-line no-shadow
export enum CloudInstanceFJEType {
  FUNCTION = 'F',
  JOB = 'J',
  EVENT = 'E',
}

export interface CloudInstanceFJE {
  type: CloudInstanceFJEType;
  hash: string;
  name: string;
  code?: string;
}

export interface CloudInstanceData {
  domains: CloudInstanceDomain[];
  functions: CloudInstanceFJE[];
  jobs: CloudInstanceFJE[];
  events: CloudInstanceFJE[];
}

export interface CloudInstanceUpdateData {
  domains?: CloudInstanceDomain[];
  functions?: CloudInstanceFJE[];
  jobs?: CloudInstanceFJE[];
  events?: CloudInstanceFJE[];
}
export interface CloudInstanceUpdateResult {
  domains: boolean;
  functions: boolean;
  events: boolean;
  jobs: boolean;
}

export interface CloudInstanceConfig {
  port: number;
  local?: boolean;
  jwt: {
    scope: string;
    secret: string;
    expireIn: number;
  };
  database: {
    prefix: string;
    fs?: boolean;
    mongodb?: {
      selfHosted?: {
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
      };
      atlas?: {
        name: string;
        user: string;
        password: string;
        cluster: string;
      };
    };
  };
  bodySizeLimit?: number;
  plugins?: string[];
  functions?: string[];
  events?: string[];
  jobs?: string[];
}

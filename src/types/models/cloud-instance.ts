export type CloudInstanceStatus =
  | 'running'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown'
  | 'restarting'
  | 'safe-mode';

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

// eslint-disable-next-line no-shadow
export enum CloudInstancePluginType {
  /**
   * Local plugin upload to an instance
   */
  LOCAL = 'L',
  /**
   * Remote plugin, should be downloaded from the BCMS Cloud.
   */
  REMOTE = 'R',
  /**
   * Plugin present in an Instance bundle.
   */
  BUNDLE = 'B',
}
export interface CloudInstancePlugin {
  id: string;
  name: string;
  tag: string;
  type: CloudInstancePluginType;
  version?: string;
  active?: boolean;
  buffer?: Buffer;
}

export interface CloudInstanceEnv {
  name: string;
  value: string;
}

export interface CloudInstanceData {
  domains: CloudInstanceDomain[];
  functions: CloudInstanceFJE[];
  jobs: CloudInstanceFJE[];
  events: CloudInstanceFJE[];
  plugins: CloudInstancePlugin[];
  deps?: CloudInstanceDep[];
  proxyConfig?: CloudInstanceProxyConfig[];
  env: CloudInstanceEnv[];
}

export interface CloudInstanceUpdateData {
  domains?: CloudInstanceDomain[];
  functions?: CloudInstanceFJE[];
  jobs?: CloudInstanceFJE[];
  events?: CloudInstanceFJE[];
  plugins?: CloudInstancePlugin[];
  version?: string;
  deps?: CloudInstanceDep[];
  proxyConfig?: CloudInstanceProxyConfig[];
  env?: CloudInstanceEnv[];
}
export interface CloudInstanceUpdateResult {
  domains: boolean;
  functions: boolean;
  events: boolean;
  jobs: boolean;
  plugins: boolean;
  deps: boolean;
  proxyConfig: boolean;
  env: boolean;
}

export interface CloudInstanceDep {
  name: string;
  version: string;
}

export interface CloudInstanceProxyConfig {
  _id: string;
  name: string;
  code: string;
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

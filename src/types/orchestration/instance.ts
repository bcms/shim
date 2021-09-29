export type InstanceStatus =
  | 'active'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown'
  | 'restarting';

export interface InstanceDomain {
  name: string;
  ssl?: {
    key: string;
    crt: string;
  };
}

export interface InstanceStats {
  id: string;
  name: string;
  ip: string;
  port: string;
  status: InstanceStatus;
  previousStatus: InstanceStatus;
}

// eslint-disable-next-line no-shadow
export enum InstanceFJEType {
  FUNCTION = 'F',
  JOB = 'J',
  EVENT = 'E',
}

export interface InstanceFJE {
  type: InstanceFJEType;
  hash: string;
  name: string;
  code?: string;
}

export interface InstanceData {
  domains: InstanceDomain[];
  functions: InstanceFJE[];
  jobs: InstanceFJE[];
  events: InstanceFJE[];
}

export interface InstanceUpdateData {
  domains?: InstanceDomain[];
  functions?: InstanceFJE[];
  jobs?: InstanceFJE[];
  events?: InstanceFJE[];
}
export interface InstanceUpdateResult {
  domains: boolean;
  functions: boolean;
  events: boolean;
  jobs: boolean;
}

export interface Instance {
  stats: InstanceStats;
  data: InstanceData;
  createSecret(): Promise<string>;
  setStatus(status: InstanceStatus): void;
  getSecret(): string;
  checkHealth(): Promise<boolean>;
  update(data: InstanceUpdateData): Promise<InstanceUpdateResult>;
  /**
   * @returns A function which will stop streaming.
   */
  streamLogs(
    onChunk: (chunk: string, type: 'stdout' | 'stderr') => void,
  ): { stop: () => void };
}

export interface InstanceConfig {
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

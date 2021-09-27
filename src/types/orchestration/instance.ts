export type InstanceStatus =
  | 'active'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown'
  | 'restarting';

export interface InstanceStats {
  id: string;
  name: string;
  ip: string;
  port: string;
  status: InstanceStatus;
  previousStatus: InstanceStatus;
}

export interface Instance {
  stats: InstanceStats;
  createSecret(): Promise<string>;
  setStatus(status: InstanceStatus): void;
  getSecret(): string;
  checkHealth(): Promise<boolean>;
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

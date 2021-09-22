export type InstanceStatus =
  | 'active'
  | 'starting'
  | 'down'
  | 'down-to-error'
  | 'unknown';

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

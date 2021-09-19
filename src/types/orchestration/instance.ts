export type InstanceStatus =
  | 'active'
  | 'starting'
  | 'down'
  | 'down-to-error';

export interface InstanceStats {
  id: string;
  name: string;
  ip: string;
  port: string;
  status: InstanceStatus;
}

export interface Instance {
  stats(): InstanceStats;
  createSecret(): Promise<string>;
  getSecret(): string;
  checkHealth(): Promise<boolean>;
  /**
   * @returns A function which will stop streaming.
   */
  streamLogs(
    onChunk: (chunk: string, type: 'stdout' | 'stderr') => void,
  ): { stop: () => void };
}

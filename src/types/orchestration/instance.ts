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
  createSecret(instanceId: string): string;
  getSecret(instanceId: string): string | undefined;
  checkHealth(instanceId: string): Promise<boolean>;
  /**
   * @returns A function which will stop streaming.
   */
  streamLogs(
    instanceId: string,
    onChunk: (chunk: string, type: 'stdout' | 'stderr') => void,
  ): { exec: () => void };
}

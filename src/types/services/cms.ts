export interface CMSService {
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
  nextPost(): Promise<number>;
}

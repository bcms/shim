export interface ShimInstanceService {
  createSecret(instanceId: string): string;
  getSecret(instanceId: string): string;
  checkHealth(
    instanceId: string,
  ): Promise<{
    ok: boolean;
    heepAvailable?: number;
    heepUsed?: number;
  }>;
}
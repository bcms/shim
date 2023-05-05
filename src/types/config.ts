export interface ShimConfig {
  local: boolean;
  manage: boolean;
  containerName: string;
  cloud: {
    domain?: string;
    port: string;
  };
  portRange: {
    from: number;
    to: number;
  };
  storagePathOnHost: string;
}

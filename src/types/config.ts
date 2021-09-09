export interface ShimConfig {
  local: boolean;
  manage: boolean;
  cloud: {
    domain: string;
    port: string;
  };
  portRange: {
    from: number;
    to: number;
  };
}

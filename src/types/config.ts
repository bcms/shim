export interface ShimConfig {
  local: boolean;
  cloud: {
    domain: string;
    port: string;
  };
  portRange: {
    from: number;
    to: number;
  };
}

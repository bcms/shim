import type {
  ConnectionService,
  SecurityService,
  ShimInstanceService,
} from './services';

export interface ShimConfig {
  local: boolean;
  cloud: {
    domain: string;
    port: string;
  };
  security: SecurityService;
  instance: ShimInstanceService;
  connection: ConnectionService;
}

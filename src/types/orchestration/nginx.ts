import type { InstanceDomain, OrchestrationMain } from '.';

export interface NginxConfig {
  orch: OrchestrationMain;
}

export interface NginxDomain extends InstanceDomain {
  instId: string;
}

export interface Nginx {
  updateConfig(): Promise<void>;
  copyConfigToContainer(): Promise<boolean>
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  restart(): Promise<boolean>;
  run(): Promise<boolean>;
  remove(): Promise<boolean>;
}

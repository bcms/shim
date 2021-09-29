import type { InstanceDomain, Orchestration } from '.';

export interface NginxConfig {
  orch: Orchestration;
}

export interface NginxDomain extends InstanceDomain {
  instId: string;
}

export interface Nginx {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  run(): Promise<void>;
  remove(): Promise<void>;
}

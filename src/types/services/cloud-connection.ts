import type { HTTPError } from '@becomes/purple-cheetah/types';
import type {
  CloudInstanceAdditionalFile,
  CloudInstanceDep,
  CloudInstanceDomain,
  CloudInstanceEnv,
  CloudInstanceFJEWithCode,
  CloudInstancePlugin,
  CloudInstanceProxyConfig,
} from '../models';

export interface CloudConnectionService {
  getInstanceData(instanceId: string): Promise<{
    domains: CloudInstanceDomain[];
    events: CloudInstanceFJEWithCode[];
    functions: CloudInstanceFJEWithCode[];
    job: CloudInstanceFJEWithCode[];
    plugins: CloudInstancePlugin[];
    deps: CloudInstanceDep[];
    proxyConfig: CloudInstanceProxyConfig[];
    env: CloudInstanceEnv[];
    additionalFiles: CloudInstanceAdditionalFile[];
  }>;
  connect(): Promise<void>;
  isConnected(instanceId: string): boolean;
  log(data: {
    instanceId: string;
    err: string;
    shimLog: string;
    instLog: string;
    date: number;
  }): Promise<void>;
  send<T>(
    instanceId: string,
    uri: string,
    payload: unknown,
    error?: HTTPError,
  ): Promise<T>;
}

export interface CloudConnection {
  connected: boolean;
  registerAfter: number;
  sendStatsAfter: number;
  channel: string;
}

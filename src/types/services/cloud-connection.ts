import type { HTTPError } from '@becomes/purple-cheetah/types';
import type { Http } from '../../util';

export interface CloudConnectionService {
  init(): void;
  http: Http;
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

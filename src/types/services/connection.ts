import type { HTTPError } from "@becomes/purple-cheetah/types";

export interface ConnectionService {
  send<T>(
    instanceId: string,
    uri: string,
    payload: unknown,
    error?: HTTPError,
  ): Promise<T>;
}

export interface Connection {
  connected: boolean;
  registerAfter: number;
  sendStatsAfter: number;
  channel: string;
}
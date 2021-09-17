import type { Instance, InstanceStats } from './instance';

export interface Orchestration {
  listInstances(
    query?: (e: Instance) => boolean | undefined,
  ): InstanceStats[];
  getInstance(instId: string): Instance | undefined;
  restart(instId: string): Promise<void>;
  start(instId: string): Promise<void>;
  stop(instId: string): Promise<void>;
  remove(instId: string): Promise<void>;
}

import type { Instance, InstanceStats } from './instance';

export interface Orchestration {
  listInstances(
    query?: (e: Instance) => boolean | undefined,
  ): InstanceStats[];
  getInstance(instId: string): Instance | undefined;
  findInstanceByDomainName(name: string): Instance | undefined;
  restart(instId: string): Promise<boolean>;
  start(instId: string): Promise<boolean>;
  stop(instId: string): Promise<boolean>;
  remove(instId: string): Promise<boolean>;
  run(instId: string): Promise<boolean>;
}

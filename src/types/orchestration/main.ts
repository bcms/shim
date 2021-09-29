import type { InstanceUpdateData } from '.';
import type { Instance } from './instance';

export interface Orchestration {
  main: OrchestrationMain;
}

export interface OrchestrationMain {
  listInstances(
    query?: (e: Instance) => boolean | undefined,
  ): Instance[];
  getInstance(instId: string): Instance | undefined;
  findInstanceByDomainName(name: string): Instance | undefined;
  restart(instId: string): Promise<boolean>;
  start(instId: string): Promise<boolean>;
  stop(instId: string): Promise<boolean>;
  remove(instId: string): Promise<boolean>;
  run(instId: string): Promise<boolean>;
  updateInstance(data: InstanceUpdateData & { id: string }): Promise<boolean>;
}

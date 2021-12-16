import type {
  ChildProcessExecOutput,
  ChildProcessOnChunk,
} from '@banez/child_process/types';
import type { DockerContainerInfo } from '@banez/docker/types';
import type {
  CloudInstanceStatus,
  CloudInstanceUpdateResult,
  CloudInstanceUpdateData,
  CloudInstanceData,
} from '../models';

export interface Container {
  id: string;
  name: string;
  port: string;
  status: CloudInstanceStatus;
  previousStatus: CloudInstanceStatus;
  info: DockerContainerInfo;
  data: CloudInstanceData;
  updateInfo(): Promise<DockerContainerInfo>;
  createSecret(): Promise<string>;
  getSecret(): string;
  setStatus(status: CloudInstanceStatus): void;
  checkHealth(): Promise<boolean>;
  update(
    data: CloudInstanceUpdateData,
  ): Promise<CloudInstanceUpdateResult>;
  streamLogs(config: {
    onChunk: ChildProcessOnChunk;
  }): ChildProcessExecOutput;
  start(onChunk?: ChildProcessOnChunk): Promise<void>;
  stop(onChunk?: ChildProcessOnChunk): Promise<void>;
  restart(onChunk?: ChildProcessOnChunk): Promise<void>;
  remove(onChunk?: ChildProcessOnChunk): Promise<void>;
  build(onChunk?: ChildProcessOnChunk): Promise<void>;
  run(onChunk?: ChildProcessOnChunk): Promise<void>;
}

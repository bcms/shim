import type {
  ChildProcessExecOutput,
  ChildProcessOnChunk,
  ChildProcessOnChunkHelperOutput,
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
  info?: DockerContainerInfo;
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
    doNotThrowError?: boolean;
  }): ChildProcessExecOutput;
  start(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
  stop(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
  restart(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
  remove(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
  build(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
  run(options?: {
    onChunk?: ChildProcessOnChunk;
    doNotThrowError?: boolean;
  }): Promise<void | ChildProcessOnChunkHelperOutput>;
}

import type {
  ChildProcessOnChunk,
  ChildProcessOnChunkHelperOutput,
} from '@banez/child_process/types';
import type { CloudInstanceDomain } from '../models';
import type { Manager } from './main';

export interface NginxConfig {
  manager: Manager;
}

export interface NginxDomain extends CloudInstanceDomain {
  instId: string;
}

export interface Nginx {
  updateConfig(): Promise<void>;
  copyConfigToContainer(): Promise<boolean>;
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

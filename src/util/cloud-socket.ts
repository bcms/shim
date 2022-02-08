import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { ChildProcessExecChunkType } from '@banez/child_process/types';
import { useSocket } from '@becomes/purple-cheetah-mod-socket';
import type { Socket } from '@becomes/purple-cheetah-mod-socket/types';
import { Manager } from '../manager';
import { Service } from '../services';

interface Connection {
  proc: ChildProcessWithoutNullStreams;
  closeAt: number;
}

setInterval(() => {
  const ids = Object.keys(CloudSocket.connections);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (CloudSocket.connections[id].closeAt < Date.now()) {
      CloudSocket.connections[id].proc.kill();
      delete CloudSocket.connections[id];
    }
  }
}, 1000);

export class CloudSocket {
  static connections: {
    [id: string]: Connection;
  } = {};
  static cloudSocket: Socket;
  static readonly TTL = 10000;

  static open(instanceId: string): void {
    if (!this.cloudSocket) {
      this.cloudSocket = useSocket();
    }
    const cont = Manager.m.container.findById(instanceId);
    if (cont && !this.connections[instanceId]) {
      const socket = this.cloudSocket;
      const proc = spawn(
        'docker',
        ['logs', '--tail', '20', '-f', `bcms-instance-${instanceId}`],
        {
          stdio: 'pipe',
        },
      );
      const onChunk = (
        type: ChildProcessExecChunkType,
        chunk: string | Buffer,
      ) => {
        socket.emitToScope({
          scope: `logs_${instanceId}`,
          eventName: 'LOG_CHUNK',
          eventData: {
            instanceId,
            data: Service.security.enc(instanceId, {
              type,
              chunk:
                chunk instanceof Buffer ? chunk.toString() : chunk,
              instanceId,
            }),
          },
        });
      };
      proc.stdout.on('data', (chunk) => {
        onChunk('stdout', chunk);
      });
      proc.stderr.on('data', (chunk) => {
        onChunk('stderr', chunk);
      });
      proc.on('close', () => {
        CloudSocket.close(instanceId);
      });
      proc.on('error', () => {
        CloudSocket.close(instanceId);
      });
      proc.on('disconnect', () => {
        CloudSocket.close(instanceId);
      });
      proc.on('exit', () => {
        CloudSocket.close(instanceId);
      });
      this.connections[instanceId] = {
        closeAt: Date.now() + this.TTL,
        proc,
      };
    }
  }

  static close(instanceId: string): void {
    if (this.connections[instanceId]) {
      this.connections[instanceId].proc.kill();
      delete this.connections[instanceId];
    }
  }

  static refresh(instanceId: string): void {
    if (this.connections[instanceId]) {
      this.connections[instanceId].closeAt = Date.now() + this.TTL;
    } else {
      this.open(instanceId);
    }
  }
}

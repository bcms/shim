import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import type { ChildProcessExecChunkType } from '@banez/child_process/types';
import { useSocket } from '@becomes/purple-cheetah-mod-socket';
import type { Socket } from '@becomes/purple-cheetah-mod-socket/types';
import { Manager } from '../manager';
import { Service } from '../services';
import { useLogger } from '@becomes/purple-cheetah';

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
  private static readonly logger = useLogger({
    name: 'Cloud socket',
  });

  static open(instanceId: string): void {
    if (!CloudSocket.cloudSocket) {
      CloudSocket.cloudSocket = useSocket();
    }
    const cont = Manager.m.container.findById(instanceId);
    if (cont && !CloudSocket.connections[instanceId]) {
      const socket = CloudSocket.cloudSocket;
      const proc = spawn(
        'docker',
        ['logs', '--tail', '20', '-f', `bcms-instance-${instanceId}`],
        {
          stdio: 'pipe',
        },
      );
      const onChunk = (
        type: ChildProcessExecChunkType,
        chunk: string,
      ) => {
        socket.emitToScope({
          scope: `logs_${instanceId}`,
          eventName: 'LOG_CHUNK',
          eventData: {
            instanceId,
            data: Service.security.enc(instanceId, {
              type,
              chunk,
              instanceId,
            }),
          },
        });
      };
      const chunks: string[] = [];
      const interval = setInterval(() => {
        if (chunks.length > 0) {
          const buffer = chunks.splice(0, chunks.length).join('');
          onChunk('stdout', buffer);
        }
      }, 200);
      proc.stdout.on('data', (chunk) => {
        chunks.push(
          chunk instanceof Buffer ? chunk.toString() : chunk,
        );
      });
      proc.stderr.on('data', (chunk) => {
        chunks.push(
          chunk instanceof Buffer ? chunk.toString() : chunk,
        );
      });
      proc.on('close', () => {
        clearInterval(interval);
        CloudSocket.close(instanceId);
      });
      proc.on('error', () => {
        clearInterval(interval);
        CloudSocket.close(instanceId);
      });
      proc.on('disconnect', () => {
        clearInterval(interval);
        CloudSocket.close(instanceId);
      });
      proc.on('exit', () => {
        clearInterval(interval);
        CloudSocket.close(instanceId);
      });
      CloudSocket.connections[instanceId] = {
        closeAt: Date.now() + CloudSocket.TTL,
        proc,
      };
    }
  }

  static close(instanceId: string): void {
    if (CloudSocket.connections[instanceId]) {
      const result = CloudSocket.connections[instanceId].proc.kill();
      if (!result) {
        CloudSocket.logger.warn(
          'close',
          `Failed to kill process ${CloudSocket.connections[instanceId].proc.pid} - ${instanceId}`,
        );
      }
      delete CloudSocket.connections[instanceId];
    }
  }

  static refresh(instanceId: string): void {
    if (CloudSocket.connections[instanceId]) {
      CloudSocket.connections[instanceId].closeAt =
        Date.now() + CloudSocket.TTL;
    } else {
      CloudSocket.open(instanceId);
    }
  }
}

export interface InspectContainerInfo {
  id: string;
  name: string;
  ip: string;
  port: string;
  up: boolean;
}

export interface DockerInspect {
  Id: string;
  State: {
    Status: string;
    Running: boolean;
    Paused: boolean;
    Restarting: boolean;
    OOMKilled: boolean;
    Dead: boolean;
    Pid: number;
    ExitCode: number;
    Error: string;
    StartedAt: string;
    FinishedAt: string;
  };
}

export interface Docker {
  inspectContainers(): Promise<InspectContainerInfo[]>;
  inspectContainer(name: string): Promise<any>;
  containerLogs(name: string, lines: number): Promise<string>;
}

export interface InspectContainerInfo {
  id: string;
  name: string;
  ip: string;
  port: string;
  up: boolean;
}

export interface Docker {
  inspectContainers(): Promise<InspectContainerInfo[]>;
}

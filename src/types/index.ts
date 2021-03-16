export interface InstanceServerStats {
  cpu: {
    cores: number;
    usage: number;
  },
  lastUpdate: number;
  ramAvailable: number;
  ramUsed: number;
  heepAvailable: number;
  heepUsed: number;
  diskAvailable: number;
  diskUsed: number;
}

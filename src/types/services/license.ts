export interface License {
  list: Array<{
    buf: Buffer;
    str: string;
  }>;
}

export interface LicenseService {
  // add(instanceId: string, license: string): void;
  // remove(instanceId: string): void;
  get(instanceId: string): License;
  getInstanceIds(): string[];
}

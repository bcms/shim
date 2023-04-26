import { CloudClient } from './cloud-client';
import { LicenseService } from './license';
import { SecurityService } from './security';

export class Service {
  static security = new SecurityService();
  static license = new LicenseService();
  static cloudClient = new CloudClient();
}

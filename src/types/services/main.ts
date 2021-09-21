import type {
  CloudConnectionService,
  SecurityService,
  LicenseService,
} from '.';

export interface Service {
  security: SecurityService;
  cloudConnection: CloudConnectionService;
  license: LicenseService;
}

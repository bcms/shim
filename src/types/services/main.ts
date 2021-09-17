import type {
  CMSService,
  CloudConnectionService,
  SecurityService,
  LicenseService,
} from '.';

export interface Service {
  security: SecurityService;
  cloudConnection: CloudConnectionService;
  cms: CMSService;
  license: LicenseService;
}

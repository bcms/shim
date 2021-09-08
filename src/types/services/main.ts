import type {
  CMSService,
  CloudConnectionService,
  SecurityService,
} from '.';

export interface Service {
  security: SecurityService;
  cloudConnection: CloudConnectionService;
  cms: CMSService;
}

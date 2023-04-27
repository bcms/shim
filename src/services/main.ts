import type { Module } from '@becomes/purple-cheetah/types';
import { CloudClient } from './cloud-client';
import { LicenseService } from './license';
import { SecurityService } from './security';

export class Service {
  static security = new SecurityService();
  static license = new LicenseService();
  static cloudClient = new CloudClient();
}

export function initializeServices(): Module {
  return {
    name: 'Initialize services',
    initialize({ next }) {
      async function init() {
        Service.license.load();
      }
      init()
        .then(() => {
          next();
        })
        .catch((err) => {
          next(err);
        });
    },
  };
}

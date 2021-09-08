import type { FSDBRepository } from '@becomes/purple-cheetah-mod-fsdb/types';
import type { CMS } from '../models';

export interface CMSRepoMethods {
  findByHistoryId(id: string): Promise<CMS | null>;
  findBySecret(secret: string): Promise<CMS | null>;
  findByPort(port: number): Promise<CMS | null>;
}

export type CMSRepo = FSDBRepository<CMS, CMSRepoMethods>;

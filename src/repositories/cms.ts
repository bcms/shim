import { createFSDBRepository } from '@becomes/purple-cheetah-mod-fsdb';
import type { Module } from '@becomes/purple-cheetah/types';
import { Repo } from '../repo';
import { Service } from '../services';
import { CMS, CMSRepoMethods, CMSSchema } from '../types';

export function createCmsRepo(): Module {
  return {
    name: 'Create CMS repository',
    initialize({ next }) {
      Repo.cms = createFSDBRepository<CMS, CMSRepoMethods>({
        name: 'CMS repository',
        collection: 'bcmsshim_cmss',
        schema: CMSSchema,
        methods({ repo }) {
          return {
            async findByPort(port) {
              return await repo.findBy((e) => e.port === port);
            },
            async findByHistoryId(id) {
              return await repo.findBy(
                (e) => !!e.history.find((t) => t.id === id),
              );
            },
            async findBySecret(secret) {
              return await repo.findBy((e) => e.secret === secret);
            },
          };
        },
      });
      next();
    },
  };
}

import {
  FSDBEntity,
  FSDBEntitySchema,
} from '@becomes/purple-cheetah-mod-fsdb/types';
import type { ObjectSchema } from '@becomes/purple-cheetah/types';

export type CMSHistoryType = 'log' | 'error' | 'update';

export interface CMSHistory {
  id: string;
  previousId?: string;
  createdAt: number;
  type: CMSHistoryType;
  message: string;
}

export const CMSHistorySchema: ObjectSchema = {
  id: {
    __type: 'string',
    __required: true,
  },
  previousId: {
    __type: 'string',
    __required: false,
  },
  createdAt: {
    __type: 'number',
    __required: true,
  },
  type: {
    __type: 'string',
    __required: true,
  },
  message: {
    __type: 'string',
    __required: true,
  },
};

export interface CMS extends FSDBEntity {
  ok: boolean;
  secret: string;
  port: number;
  volumes: string[];
  history: CMSHistory[];
}

export const CMSSchema: ObjectSchema = {
  ...FSDBEntitySchema,
  ok: {
    __type: 'boolean',
    __required: true,
  },
  secret: {
    __type: 'string',
    __required: true,
  },
  port: {
    __type: 'number',
    __required: true,
  },
  volumes: {
    __type: 'array',
    __required: true,
    __child: {
      __type: 'string',
    },
  },
  history: {
    __type: 'array',
    __required: true,
    __child: {
      __type: 'object',
      __content: CMSHistorySchema,
    },
  },
};

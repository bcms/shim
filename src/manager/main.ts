import * as path from 'path';
import { useFS, useLogger } from '@becomes/purple-cheetah';
import type { Module } from '@becomes/purple-cheetah/types';
import { ShimConfig } from '../config';
import type { Container, Manager as ManagerType } from '../types';

export const Manager: {
  m: ManagerType;
} = {
  m: undefined as never,
};

async function init() {
  if (ShimConfig.local) {
    return;
  }
  const logger = useLogger({ name: 'Container manager' });
  const containers: {
    [id: string]: {
      target: Container;
      alive: boolean;
      err: string;
      safe: boolean;
    };
  } = {};
  const fs = useFS({
    base: path.join(process.cwd()),
  });
  
}

export function createManager(): Module {
  return {
    name: 'Container manager',
    initialize({ next }) {
      init()
        .then(() => next())
        .catch((err) => next(err));
    },
  };
}

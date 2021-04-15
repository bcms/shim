import type { ShimInstanceUser } from '../types';
import { PermissionName, RoleName } from '@becomes/purple-cheetah';

export const Const: {
  dev: {
    user: ShimInstanceUser;
  };
} = {
  dev: {
    user: {
      _id: '111111111111111111111111',
      username: 'Dev User',
      firstName: 'Dev',
      lastName: 'User',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      email: 'dev@thebcms.com',
      organizations: [],
      roles: [
        {
          name: RoleName.ADMIN,
          permissions: [
            {
              name: PermissionName.WRITE,
            },
            {
              name: PermissionName.READ,
            },
            {
              name: PermissionName.DELETE,
            },
            {
              name: PermissionName.EXECUTE,
            },
          ],
        },
      ],
    },
  },
};

import { JWTPermissionName, JWTRoleName } from '@becomes/purple-cheetah-mod-jwt/types';
import type { ShimInstanceUser } from '../types';

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
          name: JWTRoleName.ADMIN,
          permissions: [
            {
              name: JWTPermissionName.WRITE,
            },
            {
              name: JWTPermissionName.READ,
            },
            {
              name: JWTPermissionName.DELETE,
            },
            {
              name: JWTPermissionName.EXECUTE,
            },
          ],
        },
      ],
    },
  },
};

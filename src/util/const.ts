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
      createdAt: Date.now(),
      updatedAt: Date.now(),
      username: 'Dev User',
      email: 'dev@thebcms.com',
      personal: {
        firstName: 'Dev',
        lastName: 'User',
        avatarUri: '',
      },
      orgs: [],
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

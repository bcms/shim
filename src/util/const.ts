import {
  JWTPermissionName,
  JWTRoleName,
} from '@becomes/purple-cheetah-mod-jwt/types';
import type { CloudUser } from '../types';

export const Const: {
  dev: {
    user: CloudUser;
    normalUser: CloudUser;
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
      orgs: [
        {
          id: '111111111',
          nameEncoded: 'becomes',
          role: JWTRoleName.ADMIN,
          owner: true,
        },
      ],
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
    normalUser: {
      _id: '211111111111111111111111',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      username: 'Normal User',
      email: 'dev2@thebcms.com',
      personal: {
        firstName: 'Normal',
        lastName: 'User',
        avatarUri: '',
      },
      orgs: [
        {
          id: '111111111',
          nameEncoded: 'becomes',
          role: JWTRoleName.USER,
          owner: false,
        },
      ],
      roles: [
        {
          name: JWTRoleName.USER,
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

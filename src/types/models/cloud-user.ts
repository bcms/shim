import type {
  JWTRole,
  JWTRoleName,
} from '@becomes/purple-cheetah-mod-jwt/types';

export interface CloudUserOrg {
  id: string;
  nameEncoded: string;
  role: JWTRoleName;
  owner: boolean;
}

export interface CloudUserPersonal {
  firstName: string;
  lastName: string;
  avatarUri: string;
}

export interface CloudUser {
  _id: string;
  createdAt: number;
  updatedAt: number;
  username: string;
  email: string;
  personal: CloudUserPersonal;
  orgs: CloudUserOrg[];
  roles: JWTRole[];
}

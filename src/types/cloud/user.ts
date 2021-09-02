import type { JWTRole, JWTRoleName } from "@becomes/purple-cheetah-mod-jwt/types";

export interface ShimInstanceUserOrg {
  id: string;
  nameEncoded: string;
  role: JWTRoleName;
  owner: boolean;
}

export interface ShimInstanceUserPersonal {
  firstName: string;
  lastName: string;
  avatarUri: string;
}

export interface ShimInstanceUser {
  _id: string;
  createdAt: number;
  updatedAt: number;
  username: string;
  email: string;
  personal: ShimInstanceUserPersonal
  orgs: ShimInstanceUserOrg[];
  roles: JWTRole[];
}

import type { Role, RoleName } from '@becomes/purple-cheetah';

export interface UserPersonal {
  firstName: string;
  lastName: string;
  avatarUri: string;
}
export interface UserCustomPool {
  personal: UserPersonal;
  organizations: Array<{
    id: string;
    role: RoleName;
    owner: boolean;
  }>;
}
export interface UserProtected {
  _id: string;
  createdAt: number;
  updatedAt: number;
  username: string;
  email: string;
  roles: Role[];
  customPool: UserCustomPool;
}

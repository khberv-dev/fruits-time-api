import { UserRole } from '@/shared/enums/user-role.enum';

export interface ReqUser {
  id: string;
  role: UserRole;
}

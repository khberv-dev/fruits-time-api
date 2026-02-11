import { UserRole } from '../enums/user-role.enum';

export class AuthPayload {
  sub: string;
  role: UserRole;
}

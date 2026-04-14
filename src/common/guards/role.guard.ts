import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserRole } from '@/shared/enums/user-role.enum';
import { Reflector } from '@nestjs/core';
import { ROLE_KEY } from '@/common/decorators/role.decorator';
import { ReqUser } from '@/shared/types/req-user.type';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const role: UserRole = this.reflector.getAllAndOverride(ROLE_KEY, [context.getHandler(), context.getClass()]);

    if (role) {
      const user: ReqUser = context.switchToHttp().getRequest()['user'];

      return user.role == role;
    } else return true;
  }
}

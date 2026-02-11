import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic: boolean = this.reflector.getAllAndOverride(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

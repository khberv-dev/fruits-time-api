import { createParamDecorator } from '@nestjs/common';
import { ReqUser } from '@/shared/types/req-user.type';

export const RequestUser = createParamDecorator((data, context) => {
  const request = context.switchToHttp().getRequest();
  return request.user as ReqUser;
});

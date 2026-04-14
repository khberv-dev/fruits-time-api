import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from '@/core/auth/auth.service';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { JwtRefreshGuard } from '@/common/guards/jwt-refresh.guard';

@Controller('auth')
@IsPublic()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  signUp(@Body() body: CreateUserRequest) {
    return this.authService.signUp(body);
  }

  @Post('sign-in')
  signIn(@Body() body: SignInRequest) {
    return this.authService.signIn(body);
  }

  @Post('refresh')
  @IsPublic()
  @UseGuards(JwtRefreshGuard)
  refreshTokens(@RequestUser() user: ReqUser) {
    return this.authService.refreshTokens(user.id, user.role);
  }
}

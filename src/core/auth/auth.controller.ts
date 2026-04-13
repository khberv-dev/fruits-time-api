import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '@/core/auth/auth.service';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';

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
}

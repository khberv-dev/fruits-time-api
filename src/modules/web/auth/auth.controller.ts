import { Body, Controller, Post } from '@nestjs/common';
import { SignInRequest } from '@/modules/app/auth/dto/sign-in-request.dto';
import { AuthService } from '@/modules/web/auth/auth.service';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-in')
  signIn(@Body() body: SignInRequest) {
    return this.authService.signIn(body);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpRequest } from './dto/send-otp-request.dto';
import { VerifyOtpRequest } from './dto/verify-otp-request.dto';
import { RegisterUserRequest } from './dto/register-user-request.dto';
import { SignInRequest } from './dto/sign-in-request.dto';
import { Public } from '@/common/decorators/public.decorator';

@Public()
@Controller('app/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  sendOtp(@Body() body: SendOtpRequest) {
    return this.authService.sendOtp(body);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: VerifyOtpRequest) {
    return this.authService.verifyOtp(body);
  }

  @Post('register')
  registerUser(@Body() body: RegisterUserRequest) {
    return this.authService.register(body);
  }

  @Post('sign-in')
  signIn(@Body() body: SignInRequest) {
    return this.authService.signIn(body);
  }

  @Get('check-phone-number')
  checkPhoneNumber(@Query('phoneNumber') phoneNumber: string) {
    return this.authService.checkPhoneNumber(phoneNumber);
  }
}

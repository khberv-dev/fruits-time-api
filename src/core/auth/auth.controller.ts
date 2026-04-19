import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthService } from '@/core/auth/auth.service';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { JwtRefreshGuard } from '@/common/guards/jwt-refresh.guard';
import { SendOtpRequest } from '@/core/auth/dto/send-otp-request.dto';
import { VerifyOtpRequest } from '@/core/auth/dto/verify-otp-request.dto';

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
  @UseGuards(JwtRefreshGuard)
  refreshTokens(@RequestUser() user: ReqUser) {
    return this.authService.refreshTokens(user.id, user.role);
  }

  @Get('check/:phoneNumber')
  async checkPhoneNumber(@Param('phoneNumber') phoneNumber: string) {
    const exists = await this.authService.checkPhoneNumber(phoneNumber);

    return {
      status: !exists,
    };
  }

  @Post('send-otp')
  async sendOtp(@Body() body: SendOtpRequest) {
    const otp = await this.authService.sendOtp(body);

    return {
      id: otp.id,
    };
  }

  @Post('verify-otp/:otpId')
  async verifyOtp(@Param('otpId') otpId: string, @Body() body: VerifyOtpRequest) {
    await this.authService.verifyOtp(otpId, body);

    return {
      status: true,
    };
  }
}

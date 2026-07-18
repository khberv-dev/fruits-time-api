import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from '@/core/auth/auth.service';
import { CreateUserRequest } from '@/core/auth/dto/create-user-request.dto';
import { SignInRequest } from '@/core/auth/dto/sign-in-request.dto';
import { IsPublic } from '@/common/decorators/is_public.decorator';
import { RequestUser } from '@/common/decorators/request-user.decorator';
import type { ReqUser } from '@/shared/types/req-user.type';
import { JwtRefreshGuard } from '@/common/guards/jwt-refresh.guard';
import { SendOtpRequest } from '@/core/auth/dto/send-otp-request.dto';
import { VerifyOtpRequest } from '@/core/auth/dto/verify-otp-request.dto';
import { ResetPasswordRequest } from '@/core/auth/dto/reset-password-request.dto';
import { TelegramSignUpRequest } from '@/core/auth/dto/telegram-sign-up-request.dto';
import { TelegramBotGuard } from '@/common/guards/telegram-bot.guard';

@ApiTags('Auth')
@Controller('auth')
@IsPublic()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  @ApiOperation({
    summary: 'Register a new account',
    description: 'Creates a USER-role account and returns a fresh access/refresh token pair.',
  })
  @ApiOkResponse({
    description: 'Account created',
    schema: {
      example: {
        id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiConflictResponse({ description: 'Phone number already registered' })
  signUp(@Body() body: CreateUserRequest) {
    return this.authService.signUp(body);
  }

  @Post('telegram/sign-up')
  @UseGuards(TelegramBotGuard)
  @ApiHeader({ name: 'x-telegram-bot-secret', description: 'Shared bot secret (TELEGRAM_BOT_SECRET)', required: true })
  @ApiOperation({
    summary: 'Register (or link) an account from the Telegram bot',
    description:
      'Bot-only endpoint (requires the `x-telegram-bot-secret` header). Skips SMS OTP entirely since the phone ' +
      "number comes pre-verified from Telegram's own contact-share flow, and creates the account without a " +
      "password. If the phone number already belongs to an existing account, links that account's telegramId " +
      'instead of creating a new one. Returns a fresh access/refresh token pair either way.',
  })
  @ApiOkResponse({
    description: 'Account created or linked',
    schema: {
      example: {
        id: '6b0a0e1e-5f55-4a3a-9a9b-3a4f2c8a0c1e',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bot secret' })
  @ApiConflictResponse({ description: 'Phone number or telegramId already linked to a different account' })
  telegramSignUp(@Body() body: TelegramSignUpRequest) {
    return this.authService.telegramSignUp(body);
  }

  @Get('telegram/check-phone/:phoneNumber')
  @UseGuards(TelegramBotGuard)
  @ApiHeader({ name: 'x-telegram-bot-secret', description: 'Shared bot secret (TELEGRAM_BOT_SECRET)', required: true })
  @ApiOperation({
    summary: 'Check whether a phone number is available for Telegram sign-up',
    description:
      'Bot-only endpoint (requires the `x-telegram-bot-secret` header). `status: true` means the number is free; ' +
      '`false` means it is already registered.',
  })
  @ApiParam({ name: 'phoneNumber', example: '998901234567', description: '12-digit phone number' })
  @ApiOkResponse({ schema: { example: { status: true } } })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bot secret' })
  async telegramCheckPhoneNumber(@Param('phoneNumber') phoneNumber: string) {
    const exists = await this.authService.checkPhoneNumber(phoneNumber);

    return {
      status: !exists,
    };
  }

  @Post('sign-in')
  @ApiOperation({
    summary: 'Sign in with phone + password',
    description: 'Returns a new access/refresh token pair.',
  })
  @ApiOkResponse({
    description: 'Authenticated',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Wrong phone number or password' })
  signIn(@Body() body: SignInRequest) {
    return this.authService.signIn(body);
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description: 'Send the refresh token in the `Authorization: Bearer <refreshToken>` header.',
  })
  @ApiOkResponse({
    description: 'Fresh token pair issued',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Refresh token missing, expired, or invalid' })
  refreshTokens(@RequestUser() user: ReqUser) {
    return this.authService.refreshTokens(user.id, user.role);
  }

  @Get('check/:phoneNumber')
  @ApiOperation({
    summary: 'Check whether a phone number is available for sign-up',
    description: '`status: true` means the number is free; `false` means it is already registered.',
  })
  @ApiParam({ name: 'phoneNumber', example: '998901234567', description: '12-digit phone number' })
  @ApiOkResponse({ schema: { example: { status: true } } })
  async checkPhoneNumber(@Param('phoneNumber') phoneNumber: string) {
    const exists = await this.authService.checkPhoneNumber(phoneNumber);

    return {
      status: !exists,
    };
  }

  @Post('send-otp')
  @ApiOperation({
    summary: 'Send a 5-digit SMS verification code',
    description: 'Returns the OTP session id to use with `verify-otp`. The code is delivered via Eskiz SMS.',
  })
  @ApiOkResponse({
    description: 'OTP sent',
    schema: { example: { id: 'a3b8e6e0-f6b1-4f6e-8c1e-2d5b7e5e0a11' } },
  })
  async sendOtp(@Body() body: SendOtpRequest) {
    const otp = await this.authService.sendOtp(body);

    return {
      id: otp.id,
    };
  }

  @Post('verify-otp/:otpId')
  @ApiOperation({
    summary: 'Verify the SMS code for a previously issued OTP session',
    description: 'Each session allows up to 3 attempts and expires after 15 minutes.',
  })
  @ApiParam({
    name: 'otpId',
    description: 'OTP session id returned by `send-otp`',
    example: 'a3b8e6e0-f6b1-4f6e-8c1e-2d5b7e5e0a11',
  })
  @ApiOkResponse({ description: 'Code accepted', schema: { example: { status: true } } })
  @ApiBadRequestResponse({ description: 'Wrong session id, expired session, or wrong code' })
  async verifyOtp(@Param('otpId') otpId: string, @Body() body: VerifyOtpRequest) {
    await this.authService.verifyOtp(otpId, body);

    return {
      status: true,
    };
  }

  @Post('reset-password/:otpId')
  @ApiOperation({
    summary: 'Set a new password for the phone number behind a verified OTP session',
    description:
      'Requires `verify-otp` to have already succeeded for this `otpId`. The phone number is read from the OTP session, not the request body.',
  })
  @ApiParam({
    name: 'otpId',
    description: 'OTP session id returned by `send-otp`, already confirmed via `verify-otp`',
    example: 'a3b8e6e0-f6b1-4f6e-8c1e-2d5b7e5e0a11',
  })
  @ApiOkResponse({ description: 'Password updated', schema: { example: { status: true } } })
  @ApiBadRequestResponse({ description: 'OTP session not found/not verified, or no account with that phone number' })
  async resetPassword(@Param('otpId') otpId: string, @Body() body: ResetPasswordRequest) {
    await this.authService.resetPassword(otpId, body.password);

    return {
      status: true,
    };
  }
}

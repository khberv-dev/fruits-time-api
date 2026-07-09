import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private logger = new Logger('SMS Service');

  apiClient: AxiosInstance;
  accessToken: string;

  constructor(private readonly config: ConfigService) {
    this.apiClient = axios.create({
      baseURL: config.getOrThrow('ESKIZ_SMS_BASE_API_URL'),
    });

    this.auth();

    this.apiClient.interceptors.request.use((config) => {
      config.headers['Authorization'] = `Bearer ${this.accessToken}`;

      return config;
    });
  }

  private async auth() {
    try {
      const response = await this.apiClient.post('auth/login', {
        email: this.config.getOrThrow('ESKIZ_SMS_LOGIN'),
        password: this.config.getOrThrow('ESKIZ_SMS_PASSWORD'),
      });

      this.accessToken = response.data.data.token;
      this.logger.log('Auth completed');
    } catch (error) {
      this.logger.error(`auth failed: ${this.formatError(error)}`);
    }
  }

  async sendOTP(code: string, phoneNumber: string) {
    const otpMessage = 'Fruits Time ilovasiga kirish uchun kod: ';
    try {
      const response = await this.apiClient.post('message/sms/send', {
        mobile_phone: phoneNumber,
        message: otpMessage + code,
        from: this.config.getOrThrow('ESKIZ_SMS_FROM'),
      });

      return response.data;
    } catch (error) {
      this.logger.error(`sendOTP failed for ${phoneNumber}: ${this.formatError(error)}`);
      throw error;
    }
  }

  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 'no-status';
      const body = error.response?.data ? JSON.stringify(error.response.data) : 'no-body';
      return `[${status}] ${error.message} ${body}`;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

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
    const response = await this.apiClient.post('auth/login', {
      email: this.config.getOrThrow('ESKIZ_SMS_LOGIN'),
      password: this.config.getOrThrow('ESKIZ_SMS_PASSWORD'),
    });

    this.accessToken = response.data.data.token;
    this.logger.log('Auth completed');
  }

  async sendOTP(code: string, phoneNumber: string) {
    const otpMessage = 'Fruits Time ilovasiga kirish uchun kod: ';
    const response = await this.apiClient.post('message/sms/send', {
      mobile_phone: phoneNumber,
      message: otpMessage + code,
      from: this.config.getOrThrow('ESKIZ_SMS_FROM'),
    });

    return response.data;
  }
}

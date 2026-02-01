import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { BusinessMetricsInterceptor, GrpcMetricsInterceptor } from 'src/supervision/metrics/interceptors';
import { AuthService } from './auth.service';
import {
  AUTH_SERVICE_NAME,
  type SignInRequest,
  type Token,
  type AuthResponse,
  type RefreshTokensResponse,
  type SignUpRequest,
} from 'src/generated-types/auth';
import type { StatusResponse, User } from 'src/generated-types/user';

@Controller('auth')
@UseInterceptors(GrpcMetricsInterceptor, BusinessMetricsInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  protected readonly logger = new Logger(AuthController.name);

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignUp')
  async signUp(data: SignUpRequest): Promise<User> {
    this.logger.log(`Received SignUp request for email: ${data.email}`);
    return await this.authService.signUp(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'ResendConfirmationEmail')
  async resendConfirmationEmail(data: { email: string }): Promise<StatusResponse> {
    this.logger.log(`Received ResendConfirmationEmail request for email: ${data.email}`);
    return await this.authService.resendConfirmationEmail(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'VerifyEmail')
  async verifyEmail(data: Token): Promise<AuthResponse> {
    this.logger.log(`Received VerifyEmail request with token: ${data.token}`);
    return await this.authService.verifyEmail(data.token);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignIn')
  async signIn(data: SignInRequest): Promise<AuthResponse> {
    this.logger.log(`Received SignIn request for email: ${data.email}`);
    return await this.authService.signIn(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'RefreshTokens')
  async refreshToken(data: Token): Promise<RefreshTokensResponse> {
    this.logger.log(`Received RefreshToken request with token: ${data.token}`);
    return await this.authService.refreshTokens(data.token);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'InitResetPassword')
  async initResetPassword(data: { email: string }): Promise<StatusResponse> {
    this.logger.log(`Received InitResetPassword request for email: ${data.email}`);
    return await this.authService.initResetPassword(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'ResendResetPasswordEmail')
  async resendResetPasswordEmail(data: { email: string }): Promise<StatusResponse> {
    this.logger.log(`Received ResendResetPasswordEmail request for email: ${data.email}`);
    return await this.authService.resendResetPasswordEmail(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SetNewPassword')
  async setNewPassword(data: { token: string; password: string }): Promise<StatusResponse> {
    this.logger.log(`Received SetNewPassword request with token: ${data.token}`);
    return await this.authService.setNewPassword(data.token, data.password);
  }
}

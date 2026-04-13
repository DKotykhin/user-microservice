import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { BusinessMetricsInterceptor, GrpcMetricsInterceptor } from 'src/supervision/metrics/interceptors';
import { AuthService } from './auth.service';

import {
  AUTH_SERVICE_NAME,
  type OAuthSignInRequest,
  type SignInRequest,
  type Token,
  type VerifyEmailRequest,
  type AuthResponse,
  type RefreshTokensResponse,
  type SignUpRequest,
  type SignOutRequest,
  type SetNewPasswordRequest,
  type Email,
} from 'src/generated-types/auth';
import type { Id, StatusResponse, User } from 'src/generated-types/user';

@Controller('auth')
@UseInterceptors(GrpcMetricsInterceptor, BusinessMetricsInterceptor)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignUp')
  async signUp(data: SignUpRequest): Promise<User> {
    this.logger.log(`Received SignUp request for email: ${data.email}`);
    return await this.authService.signUp(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'ResendConfirmationEmail')
  async resendConfirmationEmail(data: Email): Promise<StatusResponse> {
    this.logger.log(`Received ResendConfirmationEmail request for email: ${data.email}`);
    return await this.authService.resendConfirmationEmail(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'VerifyEmail')
  async verifyEmail(data: VerifyEmailRequest): Promise<AuthResponse> {
    this.logger.log(`Received VerifyEmail request with token: ${data.token}`);
    return await this.authService.verifyEmail(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignIn')
  async signIn(data: SignInRequest): Promise<AuthResponse> {
    this.logger.log(`Received SignIn request for email: ${data.email}`);
    return await this.authService.signIn(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'RefreshTokens')
  async refreshToken(data: Token): Promise<RefreshTokensResponse> {
    this.logger.log(`Received RefreshToken request with token: ${data.token.slice(0, 10)}...`);
    return await this.authService.refreshTokens(data.token);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'InitResetPassword')
  async initResetPassword(data: Email): Promise<StatusResponse> {
    this.logger.log(`Received InitResetPassword request for email: ${data.email}`);
    return await this.authService.initResetPassword(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'ResendResetPasswordEmail')
  async resendResetPasswordEmail(data: Email): Promise<StatusResponse> {
    this.logger.log(`Received ResendResetPasswordEmail request for email: ${data.email}`);
    return await this.authService.resendResetPasswordEmail(data.email);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SetNewPassword')
  async setNewPassword(data: SetNewPasswordRequest): Promise<StatusResponse> {
    this.logger.log(`Received SetNewPassword request with token: ${data.token.slice(0, 10)}...`);
    return await this.authService.setNewPassword(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignOutCurrentDevice')
  async signOutCurrentDevice(data: SignOutRequest): Promise<StatusResponse> {
    return this.authService.signOutCurrentDevice(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignOutOtherDevices')
  async signOutOtherDevices(data: SignOutRequest): Promise<StatusResponse> {
    return this.authService.signOutOtherDevices(data);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'SignOutAllDevices')
  async signOutAllDevices(data: Id): Promise<StatusResponse> {
    return this.authService.signOutAllDevices(data.id);
  }

  @GrpcMethod(AUTH_SERVICE_NAME, 'OAuthSignIn')
  async oauthSignIn(data: OAuthSignInRequest): Promise<AuthResponse> {
    this.logger.log(`Received OAuthSignIn request for provider: ${data.provider}`);
    return await this.authService.oauthSignIn(data);
  }
}

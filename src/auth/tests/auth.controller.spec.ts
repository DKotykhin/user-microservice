import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { UserRole } from 'src/generated-types/user';
import { GrpcMetricsInterceptor, BusinessMetricsInterceptor } from 'src/supervision/metrics/interceptors';

describe('AuthController', () => {
  let controller: AuthController;

  const authServiceMock = {
    signUp: jest.fn(),
    resendConfirmationEmail: jest.fn(),
    verifyEmail: jest.fn(),
    signIn: jest.fn(),
    refreshTokens: jest.fn(),
    initResetPassword: jest.fn(),
    resendResetPasswordEmail: jest.fn(),
    setNewPassword: jest.fn(),
    signOutOtherDevices: jest.fn(),
    signOutAllDevices: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    isEmailVerified: true,
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  const mockAuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    user: mockUser,
  };

  const mockStatusResponse = {
    success: true,
    message: 'Operation completed successfully',
  };

  const mockRefreshTokensResponse = {
    accessToken: 'new-access-token',
    refreshToken: 'new-refresh-token',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    })
      .overrideInterceptor(GrpcMetricsInterceptor)
      .useValue({})
      .overrideInterceptor(BusinessMetricsInterceptor)
      .useValue({})
      .compile();

    controller = module.get<AuthController>(AuthController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signUp', () => {
    const signUpData = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should call authService.signUp and return user', async () => {
      authServiceMock.signUp.mockResolvedValue(mockUser);

      const result = await controller.signUp(signUpData);

      expect(authServiceMock.signUp).toHaveBeenCalledWith(signUpData);
      expect(result).toEqual(mockUser);
    });

    it('should propagate errors from authService.signUp', async () => {
      const error = new Error('Sign up failed');
      authServiceMock.signUp.mockRejectedValue(error);

      await expect(controller.signUp(signUpData)).rejects.toThrow(error);
    });
  });

  describe('resendConfirmationEmail', () => {
    const emailData = { email: 'test@example.com' };

    it('should call authService.resendConfirmationEmail and return status response', async () => {
      authServiceMock.resendConfirmationEmail.mockResolvedValue(mockStatusResponse);

      const result = await controller.resendConfirmationEmail(emailData);

      expect(authServiceMock.resendConfirmationEmail).toHaveBeenCalledWith(emailData.email);
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.resendConfirmationEmail', async () => {
      const error = new Error('Resend confirmation email failed');
      authServiceMock.resendConfirmationEmail.mockRejectedValue(error);

      await expect(controller.resendConfirmationEmail(emailData)).rejects.toThrow(error);
    });
  });

  describe('verifyEmail', () => {
    const tokenData = { token: 'verification-token' };

    it('should call authService.verifyEmail and return auth response', async () => {
      authServiceMock.verifyEmail.mockResolvedValue(mockAuthResponse);

      const result = await controller.verifyEmail(tokenData);

      expect(authServiceMock.verifyEmail).toHaveBeenCalledWith(tokenData.token);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should propagate errors from authService.verifyEmail', async () => {
      const error = new Error('Verify email failed');
      authServiceMock.verifyEmail.mockRejectedValue(error);

      await expect(controller.verifyEmail(tokenData)).rejects.toThrow(error);
    });
  });

  describe('signIn', () => {
    const signInData = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should call authService.signIn and return auth response', async () => {
      authServiceMock.signIn.mockResolvedValue(mockAuthResponse);

      const result = await controller.signIn(signInData);

      expect(authServiceMock.signIn).toHaveBeenCalledWith(signInData);
      expect(result).toEqual(mockAuthResponse);
    });

    it('should propagate errors from authService.signIn', async () => {
      const error = new Error('Sign in failed');
      authServiceMock.signIn.mockRejectedValue(error);

      await expect(controller.signIn(signInData)).rejects.toThrow(error);
    });
  });

  describe('refreshToken', () => {
    const tokenData = { token: 'refresh-token' };

    it('should call authService.refreshTokens and return refresh tokens response', async () => {
      authServiceMock.refreshTokens.mockResolvedValue(mockRefreshTokensResponse);

      const result = await controller.refreshToken(tokenData);

      expect(authServiceMock.refreshTokens).toHaveBeenCalledWith(tokenData.token);
      expect(result).toEqual(mockRefreshTokensResponse);
    });

    it('should propagate errors from authService.refreshTokens', async () => {
      const error = new Error('Refresh token failed');
      authServiceMock.refreshTokens.mockRejectedValue(error);

      await expect(controller.refreshToken(tokenData)).rejects.toThrow(error);
    });
  });

  describe('initResetPassword', () => {
    const emailData = { email: 'test@example.com' };

    it('should call authService.initResetPassword and return status response', async () => {
      authServiceMock.initResetPassword.mockResolvedValue(mockStatusResponse);

      const result = await controller.initResetPassword(emailData);

      expect(authServiceMock.initResetPassword).toHaveBeenCalledWith(emailData.email);
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.initResetPassword', async () => {
      const error = new Error('Init reset password failed');
      authServiceMock.initResetPassword.mockRejectedValue(error);

      await expect(controller.initResetPassword(emailData)).rejects.toThrow(error);
    });
  });

  describe('resendResetPasswordEmail', () => {
    const emailData = { email: 'test@example.com' };

    it('should call authService.resendResetPasswordEmail and return status response', async () => {
      authServiceMock.resendResetPasswordEmail.mockResolvedValue(mockStatusResponse);

      const result = await controller.resendResetPasswordEmail(emailData);

      expect(authServiceMock.resendResetPasswordEmail).toHaveBeenCalledWith(emailData.email);
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.resendResetPasswordEmail', async () => {
      const error = new Error('Resend reset password email failed');
      authServiceMock.resendResetPasswordEmail.mockRejectedValue(error);

      await expect(controller.resendResetPasswordEmail(emailData)).rejects.toThrow(error);
    });
  });

  describe('setNewPassword', () => {
    const setNewPasswordData = { token: 'reset-token', password: 'new-password' };

    it('should call authService.setNewPassword and return status response', async () => {
      authServiceMock.setNewPassword.mockResolvedValue(mockStatusResponse);

      const result = await controller.setNewPassword(setNewPasswordData);

      expect(authServiceMock.setNewPassword).toHaveBeenCalledWith(
        setNewPasswordData.token,
        setNewPasswordData.password,
      );
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.setNewPassword', async () => {
      const error = new Error('Set new password failed');
      authServiceMock.setNewPassword.mockRejectedValue(error);

      await expect(controller.setNewPassword(setNewPasswordData)).rejects.toThrow(error);
    });
  });

  describe('signOutOtherDevices', () => {
    const signOutOtherDevicesData = { id: 'user-123', currentSessionId: 'session-456' };

    it('should call authService.signOutOtherDevices and return status response', async () => {
      authServiceMock.signOutOtherDevices.mockResolvedValue(mockStatusResponse);

      const result = await controller.signOutOtherDevices(signOutOtherDevicesData);

      expect(authServiceMock.signOutOtherDevices).toHaveBeenCalledWith(
        signOutOtherDevicesData.id,
        signOutOtherDevicesData.currentSessionId,
      );
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.signOutOtherDevices', async () => {
      const error = new Error('Sign out other devices failed');
      authServiceMock.signOutOtherDevices.mockRejectedValue(error);

      await expect(controller.signOutOtherDevices(signOutOtherDevicesData)).rejects.toThrow(error);
    });
  });

  describe('signOutAllDevices', () => {
    const signOutAllDevicesData = { id: 'user-123' };

    it('should call authService.signOutAllDevices and return status response', async () => {
      authServiceMock.signOutAllDevices.mockResolvedValue(mockStatusResponse);

      const result = await controller.signOutAllDevices(signOutAllDevicesData);

      expect(authServiceMock.signOutAllDevices).toHaveBeenCalledWith(signOutAllDevicesData.id);
      expect(result).toEqual(mockStatusResponse);
    });

    it('should propagate errors from authService.signOutAllDevices', async () => {
      const error = new Error('Sign out all devices failed');
      authServiceMock.signOutAllDevices.mockRejectedValue(error);

      await expect(controller.signOutAllDevices(signOutAllDevicesData)).rejects.toThrow(error);
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../auth.service';
import { HashService } from 'src/hash/hash.service';
import { TokenService } from 'src/token/token.service';
import { AuthRepository } from '../auth.repository';
import { UserRepository } from 'src/user/user.repository';
import { RedisService } from 'src/redis/redis.service';
import { MessageBrokerService } from 'src/transport/message-broker/message-broker.service';
import { RateLimiterService } from 'src/rate-limiter/rate-limiter.service';
import { DeviceService } from 'src/device/device.service';
import { AppError } from 'src/utils/errors/app-error';
import { UserRole } from 'src/generated-types/user';

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-crypto-token'),
  })),
  randomUUID: jest.fn(() => 'mock-uuid'),
  createHash: jest.fn(() => ({
    update: jest.fn(() => ({
      digest: jest.fn(() => 'mock-device-hash-value'),
    })),
  })),
}));

describe('AuthService', () => {
  let service: AuthService;

  const hashServiceMock = {
    create: jest.fn(),
    compare: jest.fn(),
    theSame: jest.fn(),
    validate: jest.fn(),
  };

  const tokenServiceMock = {
    generateJwtTokens: jest.fn(),
    verifyJwtToken: jest.fn(),
    refreshKey: jest.fn(),
  };

  const authRepositoryMock = {
    findEmailVerificationTokenByToken: jest.fn(),
    findEmailVerificationTokenByUserId: jest.fn(),
    createEmailVerificationToken: jest.fn(),
    updateEmailVerificationToken: jest.fn(),
    findPasswordResetTokenByToken: jest.fn(),
    findPasswordResetTokenByUserId: jest.fn(),
    createPasswordResetToken: jest.fn(),
    updatePasswordResetTokenById: jest.fn(),
  };

  const userRepositoryMock = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
  };

  const redisServiceMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  };

  const messageBrokerServiceMock = {
    emitMessage: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        FRONTEND_URL: 'http://localhost:3000',
        EMAIL_TOKEN_TTL: 3600,
        PASSWORD_RESET_TOKEN_TTL: 3600,
      };
      return config[key];
    }),
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        FRONTEND_URL: 'http://localhost:3000',
        EMAIL_TOKEN_TTL: 3600,
        PASSWORD_RESET_TOKEN_TTL: 3600,
      };
      return config[key];
    }),
  };

  const rateLimiterServiceMock = {
    checkRateLimit: jest.fn(),
    checkLockout: jest.fn(),
    recordFailedAttempt: jest.fn(),
    resetRateLimit: jest.fn(),
  };

  const deviceServiceMock = {
    generateDeviceId: jest.fn(),
    isKnownDevice: jest.fn(),
    registerDevice: jest.fn(),
    updateDeviceLastUsed: jest.fn(),
    removeAllDevices: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    role: 'USER',
    isEmailVerified: true,
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  const mockUnverifiedUser = {
    ...mockUser,
    isEmailVerified: false,
  };

  const mockBannedUser = {
    ...mockUser,
    isBanned: true,
  };

  const mockEmailVerification = {
    id: 'verification-123',
    userId: 'user-123',
    token: 'verification-token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    verifiedAt: null,
    user: mockUser,
  };

  const mockExpiredEmailVerification = {
    ...mockEmailVerification,
    expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
  };

  const mockPasswordResetToken = {
    id: 'reset-123',
    userId: 'user-123',
    token: 'reset-token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    changedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: HashService, useValue: hashServiceMock },
        { provide: TokenService, useValue: tokenServiceMock },
        { provide: AuthRepository, useValue: authRepositoryMock },
        { provide: UserRepository, useValue: userRepositoryMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: MessageBrokerService, useValue: messageBrokerServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: RateLimiterService, useValue: rateLimiterServiceMock },
        { provide: DeviceService, useValue: deviceServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();

    // Reset rate limiter mocks to default (resolving) behavior after each clear
    rateLimiterServiceMock.checkRateLimit.mockResolvedValue(undefined);
    rateLimiterServiceMock.checkLockout.mockResolvedValue(undefined);
    rateLimiterServiceMock.recordFailedAttempt.mockResolvedValue({
      currentAttempts: 0,
      attemptsLeft: 5,
      isLocked: false,
    });
    rateLimiterServiceMock.resetRateLimit.mockResolvedValue(undefined);
    deviceServiceMock.removeAllDevices.mockResolvedValue(undefined);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    const signUpData = {
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
    };

    it('should create a new user and send verification email', async () => {
      const newUser = { ...mockUser, id: 'new-user-id', email: signUpData.email, name: signUpData.name };
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);
      hashServiceMock.create.mockResolvedValue('hashed-password');
      userRepositoryMock.createUser.mockResolvedValue(newUser);
      authRepositoryMock.createEmailVerificationToken.mockResolvedValue({});

      const result = await service.signUp(signUpData);

      expect(userRepositoryMock.findUserByEmail).toHaveBeenCalledWith(signUpData.email);
      expect(hashServiceMock.create).toHaveBeenCalledWith(signUpData.password);
      expect(userRepositoryMock.createUser).toHaveBeenCalledWith({
        data: signUpData,
        passwordHash: 'hashed-password',
      });
      expect(authRepositoryMock.createEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: signUpData.email,
          subject: 'Verify your email',
          template: 'verify-email',
        }),
      );
      expect(result).toEqual({
        ...newUser,
        role: UserRole.USER,
      });
    });

    it('should throw conflict error if email is already verified', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
      await expect(service.signUp(signUpData)).rejects.toThrow('Email is already in use');
    });

    it('should resend verification email if user exists but no verification token', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(null);
      authRepositoryMock.createEmailVerificationToken.mockResolvedValue({});

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
      expect(authRepositoryMock.createEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
    });

    it('should resend verification email if existing token is expired', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockExpiredEmailVerification);
      authRepositoryMock.updateEmailVerificationToken.mockResolvedValue({});

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
      expect(authRepositoryMock.updateEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
    });

    it('should throw conflict if user exists with valid non-expired token', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockEmailVerification);

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
    });

    it('should throw error if user creation fails', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);
      hashServiceMock.create.mockResolvedValue('hashed-password');
      userRepositoryMock.createUser.mockResolvedValue(null);

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
    });

    it('should throw internal server error for unexpected errors', async () => {
      userRepositoryMock.findUserByEmail.mockRejectedValue(new Error('Database error'));

      await expect(service.signUp(signUpData)).rejects.toThrow(AppError);
    });
  });

  describe('resendConfirmationEmail', () => {
    it('should check rate limit before processing', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockEmailVerification);
      authRepositoryMock.updateEmailVerificationToken.mockResolvedValue({});

      await service.resendConfirmationEmail(mockUnverifiedUser.email);

      expect(rateLimiterServiceMock.checkRateLimit).toHaveBeenCalledWith(
        'email_resend',
        mockUnverifiedUser.email,
        expect.objectContaining({ maxAttempts: 3, windowSeconds: 300 }),
      );
    });

    it('should resend confirmation email by updating existing token', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockEmailVerification);
      authRepositoryMock.updateEmailVerificationToken.mockResolvedValue({});

      const result = await service.resendConfirmationEmail(mockUnverifiedUser.email);

      expect(authRepositoryMock.updateEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Confirmation email resent successfully' });
    });

    it('should create new token if no existing token found', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(null);
      authRepositoryMock.createEmailVerificationToken.mockResolvedValue({});

      const result = await service.resendConfirmationEmail(mockUnverifiedUser.email);

      expect(authRepositoryMock.createEmailVerificationToken).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Confirmation email resent successfully' });
    });

    it('should throw error if user not found', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);

      await expect(service.resendConfirmationEmail('notfound@example.com')).rejects.toThrow(AppError);
    });

    it('should throw error if email is already verified', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);

      await expect(service.resendConfirmationEmail(mockUser.email)).rejects.toThrow(AppError);
    });

    it('should throw error if rate limit exceeded', async () => {
      rateLimiterServiceMock.checkRateLimit.mockRejectedValue(
        AppError.tooManyRequests('Too many attempts. Please try again later.'),
      );

      await expect(service.resendConfirmationEmail('test@example.com')).rejects.toThrow(AppError);
    });

    it('should throw internal server error for unexpected errors', async () => {
      userRepositoryMock.findUserByEmail.mockRejectedValue(new Error('Database error'));

      await expect(service.resendConfirmationEmail('test@example.com')).rejects.toThrow(AppError);
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and return auth response with tokens', async () => {
      const verificationWithUnverifiedUser = {
        ...mockEmailVerification,
        user: mockUnverifiedUser,
      };
      authRepositoryMock.findEmailVerificationTokenByToken.mockResolvedValue(verificationWithUnverifiedUser);
      authRepositoryMock.updateEmailVerificationToken.mockResolvedValue({});
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      userRepositoryMock.updateUser.mockResolvedValue({ ...mockUnverifiedUser, isEmailVerified: true });

      const result = await service.verifyEmail({ token: 'verification-token' });

      expect(authRepositoryMock.findEmailVerificationTokenByToken).toHaveBeenCalledWith('verification-token');
      expect(authRepositoryMock.updateEmailVerificationToken).toHaveBeenCalledWith({
        userId: mockEmailVerification.userId,
        token: '',
        verifiedAt: expect.any(Date) as unknown as Date,
      });
      expect(tokenServiceMock.generateJwtTokens).toHaveBeenCalled();
      expect(userRepositoryMock.updateUser).toHaveBeenCalledWith({
        id: mockEmailVerification.userId,
        data: { isEmailVerified: true },
      });
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({ isEmailVerified: true }) as unknown as Record<string, unknown>,
      });
    });

    it('should throw error for invalid token', async () => {
      authRepositoryMock.findEmailVerificationTokenByToken.mockResolvedValue(null);

      await expect(service.verifyEmail({ token: 'invalid-token' })).rejects.toThrow(AppError);
    });

    it('should throw error for expired token', async () => {
      authRepositoryMock.findEmailVerificationTokenByToken.mockResolvedValue({
        ...mockEmailVerification,
        expiresAt: new Date(Date.now() - 3600000),
      });

      await expect(service.verifyEmail({ token: 'expired-token' })).rejects.toThrow(AppError);
    });

    it('should throw error if email is already verified', async () => {
      authRepositoryMock.findEmailVerificationTokenByToken.mockResolvedValue({
        ...mockEmailVerification,
        verifiedAt: new Date(),
      });

      await expect(service.verifyEmail({ token: 'already-verified-token' })).rejects.toThrow(AppError);
    });

    it('should throw internal server error for unexpected errors', async () => {
      authRepositoryMock.findEmailVerificationTokenByToken.mockRejectedValue(new Error('Database error'));

      await expect(service.verifyEmail({ token: 'some-token' })).rejects.toThrow(AppError);
    });
  });

  describe('signIn', () => {
    const signInData = {
      email: 'test@example.com',
      password: 'password123',
    };

    const signInDataWithClientInfo = {
      ...signInData,
      clientInfo: {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      },
    };

    it('should check lockout before processing', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(true);
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await service.signIn(signInData);

      expect(rateLimiterServiceMock.checkLockout).toHaveBeenCalledWith('sign_in', signInData.email.toLowerCase());
    });

    it('should sign in user and return auth response with tokens', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(true);
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      const result = await service.signIn(signInData);

      expect(userRepositoryMock.findUserByEmail).toHaveBeenCalledWith(signInData.email);
      expect(hashServiceMock.compare).toHaveBeenCalledWith(signInData.password, mockUser.passwordHash);
      expect(userRepositoryMock.updateUser).toHaveBeenCalledWith({
        id: mockUser.id,
        data: { lastLoginAt: expect.any(Date) as unknown as Date },
      });
      expect(rateLimiterServiceMock.resetRateLimit).toHaveBeenCalledWith('sign_in', signInData.email.toLowerCase());
      expect(tokenServiceMock.generateJwtTokens).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: expect.objectContaining({ email: mockUser.email }) as unknown as Record<string, unknown>,
      });
    });

    it('should throw error if account is locked out', async () => {
      rateLimiterServiceMock.checkLockout.mockRejectedValue(
        AppError.tooManyRequests('Account is temporarily locked. Please try again in 15 minutes.'),
      );

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(userRepositoryMock.findUserByEmail).not.toHaveBeenCalled();
    });

    it('should record failed attempt and throw error if user not found', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);
      rateLimiterServiceMock.recordFailedAttempt.mockResolvedValue({
        currentAttempts: 1,
        attemptsLeft: 4,
        isLocked: false,
      });

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(rateLimiterServiceMock.recordFailedAttempt).toHaveBeenCalledWith(
        'sign_in',
        signInData.email.toLowerCase(),
        expect.objectContaining({ maxAttempts: 5 }),
      );
    });

    it('should throw forbidden error if user is banned', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockBannedUser);

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
    });

    it('should record failed attempt and throw error if password is invalid', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(false);
      rateLimiterServiceMock.recordFailedAttempt.mockResolvedValue({
        currentAttempts: 1,
        attemptsLeft: 4,
        isLocked: false,
      });

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(rateLimiterServiceMock.recordFailedAttempt).toHaveBeenCalled();
    });

    it('should lock account and send email after too many failed password attempts', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(false);
      rateLimiterServiceMock.recordFailedAttempt.mockResolvedValue({
        currentAttempts: 5,
        attemptsLeft: 0,
        isLocked: true,
        lockoutSeconds: 900,
      });

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Account Temporarily Locked - Security Alert',
          template: 'account-locked',
        }),
      );
    });

    it('should throw error and resend verification email if email not verified and no token exists', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(null);
      authRepositoryMock.createEmailVerificationToken.mockResolvedValue({});

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(authRepositoryMock.createEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
    });

    it('should throw error and resend verification email if token is expired', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockExpiredEmailVerification);
      authRepositoryMock.updateEmailVerificationToken.mockResolvedValue({});

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
      expect(authRepositoryMock.updateEmailVerificationToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
    });

    it('should throw error if email not verified with valid token', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);
      authRepositoryMock.findEmailVerificationTokenByUserId.mockResolvedValue(mockEmailVerification);

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
    });

    it('should detect new device and send notification email', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(true);
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      deviceServiceMock.generateDeviceId.mockReturnValue('device-id-123');
      deviceServiceMock.isKnownDevice.mockResolvedValue(false);

      await service.signIn(signInDataWithClientInfo);

      expect(deviceServiceMock.generateDeviceId).toHaveBeenCalledWith(
        signInDataWithClientInfo.clientInfo.ipAddress,
        signInDataWithClientInfo.clientInfo.userAgent,
      );
      expect(deviceServiceMock.isKnownDevice).toHaveBeenCalledWith(mockUser.id, 'device-id-123');
      expect(deviceServiceMock.registerDevice).toHaveBeenCalledWith(mockUser.id, {
        deviceId: 'device-id-123',
        ipAddress: signInDataWithClientInfo.clientInfo.ipAddress,
        userAgent: signInDataWithClientInfo.clientInfo.userAgent,
      });
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: mockUser.email,
          subject: 'New Login to Your Account',
          template: 'new-login',
        }),
      );
    });

    it('should update last used for known device', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(true);
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      deviceServiceMock.generateDeviceId.mockReturnValue('device-id-123');
      deviceServiceMock.isKnownDevice.mockResolvedValue(true);

      await service.signIn(signInDataWithClientInfo);

      expect(deviceServiceMock.updateDeviceLastUsed).toHaveBeenCalledWith(mockUser.id, 'device-id-123');
      expect(deviceServiceMock.registerDevice).not.toHaveBeenCalled();
    });

    it('should skip device detection when no clientInfo provided', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      hashServiceMock.compare.mockResolvedValue(true);
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

      await service.signIn(signInData);

      expect(deviceServiceMock.generateDeviceId).not.toHaveBeenCalled();
    });

    it('should throw internal server error for unexpected errors', async () => {
      userRepositoryMock.findUserByEmail.mockRejectedValue(new Error('Database error'));

      await expect(service.signIn(signInData)).rejects.toThrow(AppError);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens and return new access and refresh tokens', async () => {
      const payload = { sub: 'user-123', isBanned: false, sid: 'session-123' };
      tokenServiceMock.verifyJwtToken.mockResolvedValue(payload);
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      tokenServiceMock.refreshKey.mockReturnValue('refresh:user-123:session-123');
      redisServiceMock.get.mockResolvedValue('stored-hash');
      hashServiceMock.validate.mockResolvedValue(true);
      redisServiceMock.del.mockResolvedValue(1);
      tokenServiceMock.generateJwtTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await service.refreshTokens('refresh-token');

      expect(tokenServiceMock.verifyJwtToken).toHaveBeenCalledWith('refresh-token');
      expect(userRepositoryMock.findUserById).toHaveBeenCalledWith(payload.sub);
      expect(redisServiceMock.get).toHaveBeenCalledWith('refresh:user-123:session-123');
      expect(hashServiceMock.validate).toHaveBeenCalledWith('refresh-token', 'stored-hash');
      expect(redisServiceMock.del).toHaveBeenCalledWith('refresh:user-123:session-123');
      expect(tokenServiceMock.generateJwtTokens).toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should throw error if no token provided', async () => {
      await expect(service.refreshTokens('')).rejects.toThrow(AppError);
    });

    it('should throw error if token is invalid', async () => {
      tokenServiceMock.verifyJwtToken.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(AppError);
    });

    it('should throw error if user not found', async () => {
      tokenServiceMock.verifyJwtToken.mockResolvedValue({ sub: 'user-123', isBanned: false, sid: 'session-123' });
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.refreshTokens('refresh-token')).rejects.toThrow(AppError);
    });

    it('should throw error if no stored hash found in redis', async () => {
      tokenServiceMock.verifyJwtToken.mockResolvedValue({ sub: 'user-123', isBanned: false, sid: 'session-123' });
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      tokenServiceMock.refreshKey.mockReturnValue('refresh:user-123:session-123');
      redisServiceMock.get.mockResolvedValue(null);

      await expect(service.refreshTokens('refresh-token')).rejects.toThrow(AppError);
    });

    it('should throw error if token hash validation fails', async () => {
      tokenServiceMock.verifyJwtToken.mockResolvedValue({ sub: 'user-123', isBanned: false, sid: 'session-123' });
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      tokenServiceMock.refreshKey.mockReturnValue('refresh:user-123:session-123');
      redisServiceMock.get.mockResolvedValue('stored-hash');
      hashServiceMock.validate.mockResolvedValue(false);
      redisServiceMock.del.mockResolvedValue(1);

      await expect(service.refreshTokens('refresh-token')).rejects.toThrow(AppError);
    });

    it('should throw internal server error for unexpected errors', async () => {
      tokenServiceMock.verifyJwtToken.mockRejectedValue(new Error('Token verification failed'));

      await expect(service.refreshTokens('refresh-token')).rejects.toThrow(AppError);
    });
  });

  describe('initResetPassword', () => {
    it('should check rate limit before processing', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(null);
      authRepositoryMock.createPasswordResetToken.mockResolvedValue({});

      await service.initResetPassword(mockUser.email);

      expect(rateLimiterServiceMock.checkRateLimit).toHaveBeenCalledWith(
        'password_reset_initiate',
        mockUser.email,
        expect.objectContaining({ maxAttempts: 3, windowSeconds: 3600 }),
      );
    });

    it('should create password reset token and send email when no existing token', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(null);
      authRepositoryMock.createPasswordResetToken.mockResolvedValue({});

      const result = await service.initResetPassword(mockUser.email);

      expect(userRepositoryMock.findUserByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(authRepositoryMock.createPasswordResetToken).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Reset your password',
          template: 'reset-password',
        }),
      );
      expect(result).toEqual({ success: true, message: 'Password reset token generated successfully' });
    });

    it('should return success message if valid reset token already exists', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(mockPasswordResetToken);

      const result = await service.initResetPassword(mockUser.email);

      expect(result).toEqual({
        success: true,
        message: 'Password reset token already exists. Please check your email.',
      });
      expect(authRepositoryMock.createPasswordResetToken).not.toHaveBeenCalled();
      expect(authRepositoryMock.updatePasswordResetTokenById).not.toHaveBeenCalled();
    });

    it('should update existing expired token', async () => {
      const expiredToken = { ...mockPasswordResetToken, expiresAt: new Date(Date.now() - 3600000) };
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(expiredToken);
      authRepositoryMock.updatePasswordResetTokenById.mockResolvedValue({});

      const result = await service.initResetPassword(mockUser.email);

      expect(authRepositoryMock.updatePasswordResetTokenById).toHaveBeenCalled();
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalled();
      expect(result).toEqual({ success: true, message: 'Password reset token generated successfully' });
    });

    it('should throw error if user not found', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);

      await expect(service.initResetPassword('notfound@example.com')).rejects.toThrow(AppError);
    });

    it('should throw error if email is not verified', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);

      await expect(service.initResetPassword(mockUnverifiedUser.email)).rejects.toThrow(AppError);
    });

    it('should throw error if rate limit exceeded', async () => {
      rateLimiterServiceMock.checkRateLimit.mockRejectedValue(
        AppError.tooManyRequests('Too many attempts. Please try again later.'),
      );

      await expect(service.initResetPassword(mockUser.email)).rejects.toThrow(AppError);
    });
  });

  describe('resendResetPasswordEmail', () => {
    it('should check rate limit before processing', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(mockPasswordResetToken);

      await service.resendResetPasswordEmail(mockUser.email);

      expect(rateLimiterServiceMock.checkRateLimit).toHaveBeenCalledWith(
        'password_reset_resend',
        mockUser.email,
        expect.objectContaining({ maxAttempts: 3, windowSeconds: 300 }),
      );
    });

    it('should resend password reset email', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(mockPasswordResetToken);

      const result = await service.resendResetPasswordEmail(mockUser.email);

      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Reset your password',
        }),
      );
      expect(result).toEqual({ success: true, message: 'Password reset email resent successfully' });
    });

    it('should throw error if user not found', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(null);

      await expect(service.resendResetPasswordEmail('notfound@example.com')).rejects.toThrow(AppError);
    });

    it('should throw error if email is not verified', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUnverifiedUser);

      await expect(service.resendResetPasswordEmail(mockUnverifiedUser.email)).rejects.toThrow(AppError);
    });

    it('should throw error if no valid token exists', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue(null);

      await expect(service.resendResetPasswordEmail(mockUser.email)).rejects.toThrow(AppError);
    });

    it('should throw error if token is expired', async () => {
      userRepositoryMock.findUserByEmail.mockResolvedValue(mockUser);
      authRepositoryMock.findPasswordResetTokenByUserId.mockResolvedValue({
        ...mockPasswordResetToken,
        expiresAt: new Date(Date.now() - 3600000),
      });

      await expect(service.resendResetPasswordEmail(mockUser.email)).rejects.toThrow(AppError);
    });

    it('should throw error if rate limit exceeded', async () => {
      rateLimiterServiceMock.checkRateLimit.mockRejectedValue(
        AppError.tooManyRequests('Too many attempts. Please try again later.'),
      );

      await expect(service.resendResetPasswordEmail(mockUser.email)).rejects.toThrow(AppError);
    });
  });

  describe('setNewPassword', () => {
    it('should set new password, invalidate tokens, remove devices, and send confirmation email', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue(mockPasswordResetToken);
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      hashServiceMock.theSame.mockResolvedValue(false);
      hashServiceMock.create.mockResolvedValue('new-hashed-password');
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      authRepositoryMock.updatePasswordResetTokenById.mockResolvedValue({});
      redisServiceMock.scan.mockResolvedValue(['0', ['refresh:user-123:session-1', 'refresh:user-123:session-2']]);
      redisServiceMock.del.mockResolvedValue(2);

      const result = await service.setNewPassword({ token: 'reset-token', password: 'new-password' });

      expect(authRepositoryMock.findPasswordResetTokenByToken).toHaveBeenCalledWith('reset-token');
      expect(userRepositoryMock.findUserById).toHaveBeenCalledWith(mockPasswordResetToken.userId);
      expect(hashServiceMock.theSame).toHaveBeenCalledWith('new-password', mockUser.passwordHash);
      expect(hashServiceMock.create).toHaveBeenCalledWith('new-password');
      expect(userRepositoryMock.updateUser).toHaveBeenCalledWith({
        id: mockPasswordResetToken.userId,
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(authRepositoryMock.updatePasswordResetTokenById).toHaveBeenCalledWith({
        id: mockPasswordResetToken.id,
        token: '',
        changedAt: expect.any(Date) as unknown as Date,
      });
      expect(redisServiceMock.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `refresh:${mockPasswordResetToken.userId}:*`,
        'COUNT',
        100,
      );
      expect(redisServiceMock.del).toHaveBeenCalledWith('refresh:user-123:session-1', 'refresh:user-123:session-2');
      expect(deviceServiceMock.removeAllDevices).toHaveBeenCalledWith(mockPasswordResetToken.userId);
      expect(rateLimiterServiceMock.resetRateLimit).toHaveBeenCalledWith('password_reset', mockUser.email);
      expect(messageBrokerServiceMock.emitMessage).toHaveBeenCalledWith(
        'notification.email.send',
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Reset password confirmation',
          template: 'reset-password-confirmation',
        }),
      );
      expect(result).toEqual({ success: true, message: 'Password reset successfully' });
    });

    it('should skip redis del if no refresh tokens exist', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue(mockPasswordResetToken);
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      hashServiceMock.theSame.mockResolvedValue(false);
      hashServiceMock.create.mockResolvedValue('new-hashed-password');
      userRepositoryMock.updateUser.mockResolvedValue(mockUser);
      authRepositoryMock.updatePasswordResetTokenById.mockResolvedValue({});
      redisServiceMock.scan.mockResolvedValue(['0', []]);

      const result = await service.setNewPassword({ token: 'reset-token', password: 'new-password' });

      expect(redisServiceMock.del).not.toHaveBeenCalledWith(expect.stringContaining('refresh:'));
      expect(result).toEqual({ success: true, message: 'Password reset successfully' });
    });

    it('should throw error for invalid token', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue(null);

      await expect(service.setNewPassword({ token: 'invalid-token', password: 'new-password' })).rejects.toThrow(
        AppError,
      );
    });

    it('should throw error for expired token', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue({
        ...mockPasswordResetToken,
        expiresAt: new Date(Date.now() - 3600000),
      });

      await expect(service.setNewPassword({ token: 'expired-token', password: 'new-password' })).rejects.toThrow(
        AppError,
      );
    });

    it('should throw error if user not found', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue(mockPasswordResetToken);
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.setNewPassword({ token: 'reset-token', password: 'new-password' })).rejects.toThrow(
        AppError,
      );
    });

    it('should throw error if new password is same as old password', async () => {
      authRepositoryMock.findPasswordResetTokenByToken.mockResolvedValue(mockPasswordResetToken);
      userRepositoryMock.findUserById.mockResolvedValue(mockUser);
      hashServiceMock.theSame.mockRejectedValue(AppError.badRequest('Password cannot be the same as the old one'));

      await expect(service.setNewPassword({ token: 'reset-token', password: 'same-password' })).rejects.toThrow(
        AppError,
      );
    });
  });

  describe('signOutOtherDevices', () => {
    it('should invalidate all sessions except the current one', async () => {
      redisServiceMock.scan.mockResolvedValue([
        '0',
        ['refresh:user-123:session-1', 'refresh:user-123:session-2', 'refresh:user-123:current-session'],
      ]);
      redisServiceMock.del.mockResolvedValue(2);

      const result = await service.signOutOtherDevices({ userId: 'user-123', currentSessionId: 'current-session' });

      expect(redisServiceMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'refresh:user-123:*', 'COUNT', 100);
      expect(redisServiceMock.del).toHaveBeenCalledWith('refresh:user-123:session-1', 'refresh:user-123:session-2');
      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out from 2 other devices.',
      });
    });

    it('should return success with 0 devices if only current session exists', async () => {
      redisServiceMock.scan.mockResolvedValue(['0', ['refresh:user-123:current-session']]);

      const result = await service.signOutOtherDevices({ userId: 'user-123', currentSessionId: 'current-session' });

      expect(redisServiceMock.del).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out from 0 other devices.',
      });
    });

    it('should return success with 0 devices if no sessions exist', async () => {
      redisServiceMock.scan.mockResolvedValue(['0', []]);

      const result = await service.signOutOtherDevices({ userId: 'user-123', currentSessionId: 'current-session' });

      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out from 0 other devices.',
      });
    });

    it('should throw internal server error for unexpected errors', async () => {
      redisServiceMock.scan.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.signOutOtherDevices({ userId: 'user-123', currentSessionId: 'current-session' }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('signOutAllDevices', () => {
    it('should invalidate all sessions for the user', async () => {
      redisServiceMock.scan.mockResolvedValue([
        '0',
        ['refresh:user-123:session-1', 'refresh:user-123:session-2', 'refresh:user-123:session-3'],
      ]);
      redisServiceMock.del.mockResolvedValue(3);

      const result = await service.signOutAllDevices('user-123');

      expect(redisServiceMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'refresh:user-123:*', 'COUNT', 100);
      expect(redisServiceMock.del).toHaveBeenCalledWith(
        'refresh:user-123:session-1',
        'refresh:user-123:session-2',
        'refresh:user-123:session-3',
      );
      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out from 3 devices.',
      });
    });

    it('should return success with 0 devices if no sessions exist', async () => {
      redisServiceMock.scan.mockResolvedValue(['0', []]);

      const result = await service.signOutAllDevices('user-123');

      expect(redisServiceMock.del).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Successfully logged out from 0 devices.',
      });
    });

    it('should throw internal server error for unexpected errors', async () => {
      redisServiceMock.scan.mockRejectedValue(new Error('Redis error'));

      await expect(service.signOutAllDevices('user-123')).rejects.toThrow(AppError);
    });
  });
});

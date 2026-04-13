import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UAParser } from 'ua-parser-js';
import * as crypto from 'crypto';
import * as geoip from 'geoip-lite';
import type { User as PrismaUser } from 'prisma/generated-types/client';

import { HashService } from 'src/hash/hash.service';
import { TokenService } from 'src/token/token.service';
import { UserRepository } from 'src/user/user.repository';
import { AppError } from 'src/utils/errors/app-error';
import { convertEnum } from 'src/utils/convertEnum';
import { RedisService } from 'src/redis/redis.service';
import { MessageBrokerService } from 'src/transport/message-broker/message-broker.service';
import { RateLimiterService } from 'src/rate-limiter/rate-limiter.service';
import { DeviceService } from 'src/device/device.service';
import { AuthRepository } from './auth.repository';

import { type StatusResponse, UserRole, type User } from 'src/generated-types/user';
import type {
  AuthResponse,
  OAuthSignInRequest,
  RefreshTokensResponse,
  SetNewPasswordRequest,
  SignInRequest,
  SignOutRequest,
  SignUpRequest,
  VerifyEmailRequest,
} from 'src/generated-types/auth';
import type { EmailRequest } from 'src/transport/message-broker/email.request.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly FRONTEND_URL: string;
  private readonly EMAIL_TOKEN_TTL: number;
  private readonly PASSWORD_RESET_TOKEN_TTL: number;

  private readonly LOGIN_RATE_LIMIT = {
    maxAttempts: 5,
    windowSeconds: 300, // 5 minutes
    lockoutSeconds: 900, // 15 minute lockout after 5 failures
  };
  private readonly EMAIL_RESEND_RATE_LIMIT = {
    maxAttempts: 3,
    windowSeconds: 300, // 5 minutes
  };
  private readonly PASSWORD_RESET_RATE_LIMIT = {
    maxAttempts: 3,
    windowSeconds: 3600, // 1 hour
    lockoutSeconds: 3600, // 1 hour lockout
  };
  private readonly OAUTH_RATE_LIMIT = {
    maxAttempts: 20,
    windowSeconds: 900, // 15 minutes
    lockoutSeconds: 1800, // 30 min lockout
  };

  constructor(
    private readonly hashService: HashService,
    private readonly tokenService: TokenService,
    private readonly authRepository: AuthRepository,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly messageBrokerService: MessageBrokerService,
    private readonly configService: ConfigService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly deviceService: DeviceService,
  ) {
    this.FRONTEND_URL = this.configService.getOrThrow<string>('FRONTEND_URL');
    this.EMAIL_TOKEN_TTL = this.configService.get<number>('EMAIL_TOKEN_TTL') || 3600; // default to 1 hour
    this.PASSWORD_RESET_TOKEN_TTL = this.configService.get<number>('PASSWORD_RESET_TOKEN_TTL') || 3600; // default to 1 hour
  }

  private generateCryptoToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async scanRedisKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redisService.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  private sendVerificationEmail(to: string, token: string, name?: string | null): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Verify your email',
      template: 'verify-email',
      context: {
        name: name || 'New User',
        verificationLink: `${this.FRONTEND_URL}/verify-email?token=${token}`,
      },
    } as EmailRequest);
  }

  private sendPasswordResetEmail(to: string, token: string, name?: string | null): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Reset your password',
      template: 'reset-password',
      context: {
        name: name || 'User',
        resetLink: `${this.FRONTEND_URL}/reset-password?token=${token}`,
      },
    } as EmailRequest);
  }

  private sendPasswordResetConfirmationEmail(to: string, name?: string | null): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Reset password confirmation',
      template: 'reset-password-confirmation',
      context: {
        name: name || 'User',
      },
    } as EmailRequest);
  }

  private sendAccountLockedEmail(to: string, name?: string | null, lockoutMinutes?: number): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Account Temporarily Locked - Security Alert',
      template: 'account-locked',
      context: {
        name: name || 'User',
        lockoutMinutes: lockoutMinutes || Math.ceil(this.LOGIN_RATE_LIMIT.lockoutSeconds / 60),
      },
    } as EmailRequest);
  }

  private sendNewLoginNotificationEmail(
    to: string,
    name: string | null | undefined,
    loginInfo: {
      ipAddress: string;
      userAgent: string;
      location?: string;
      timestamp: Date;
    },
  ): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'New Login to Your Account',
      template: 'new-login',
      context: {
        name: name || 'User',
        ipAddress: loginInfo.ipAddress,
        device: loginInfo.userAgent,
        location: loginInfo.location || 'Unknown',
        timestamp: loginInfo.timestamp.toISOString(),
      },
    } as EmailRequest);
  }

  async signUp(data: SignUpRequest): Promise<User> {
    const normalizedData = { ...data, email: data.email.toLowerCase() };
    this.logger.log(`Signing up user with email: ${normalizedData.email}`);
    try {
      // Check if user with the email already exists
      const existingUser = await this.userRepository.findUserByEmail(normalizedData.email);
      if (existingUser?.isEmailVerified) {
        this.logger.warn(`Email is already in use: ${normalizedData.email}`);
        throw AppError.conflict('Email is already in use');
      }
      if (existingUser) {
        const emailVerification = await this.authRepository.findEmailVerificationTokenByUserId(existingUser.id);
        if (!emailVerification) {
          const token = this.generateCryptoToken();
          await this.authRepository.createEmailVerificationToken({
            userId: existingUser.id,
            token,
            expiresAt: new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000),
          });
          this.sendVerificationEmail(existingUser.email, token, existingUser.name);
          this.logger.log(`Resent email verification token for user ID: ${existingUser.id}`);
          throw AppError.conflict('Email is already in use but not verified. Verification email resent.');
        }
        if (emailVerification.expiresAt <= new Date()) {
          const token = this.generateCryptoToken();
          await this.authRepository.updateEmailVerificationToken({
            userId: existingUser.id,
            token,
            expiresAt: new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000),
          });
          this.sendVerificationEmail(existingUser.email, token, existingUser.name);
          this.logger.log(`Resent expired email verification token for user ID: ${existingUser.id}`);
        }
        this.logger.warn(`Email is already in use: ${normalizedData.email}`);
        throw AppError.conflict(
          'Email is already in use but not verified. Please check your email for verification link.',
        );
      }

      // Create new user
      const passwordHash = await this.hashService.create(normalizedData.password);
      const newUser = await this.userRepository.createUser({ data: normalizedData, passwordHash });
      if (!newUser) {
        this.logger.error(`Failed to create user with email: ${normalizedData.email}`);
        throw AppError.internalServerError('Failed to create user');
      }

      // Create email verification token
      const token = this.generateCryptoToken();
      await this.authRepository.createEmailVerificationToken({
        userId: newUser.id,
        token,
        expiresAt: new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000),
      });

      // Send verification email
      this.sendVerificationEmail(newUser.email, token, newUser.name);

      this.logger.log(`User created with ID: ${newUser.id}`);
      return {
        ...newUser,
        role: convertEnum(UserRole, newUser.role),
      };
    } catch (error) {
      this.logger.error(`Error during sign up: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to sign up user');
    }
  }

  async resendConfirmationEmail(rawEmail: string): Promise<StatusResponse> {
    const email = rawEmail.toLowerCase();
    this.logger.log(`Resending confirmation email to: ${email}`);
    try {
      // Check rate limit for resending confirmation email
      await this.rateLimiterService.checkRateLimit('email_resend', email, this.EMAIL_RESEND_RATE_LIMIT);

      // Find the user by email
      const user = await this.userRepository.findUserByEmail(email);
      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        throw AppError.badRequest('User with the provided email does not exist');
      }
      if (user.isEmailVerified) {
        this.logger.warn(`Email is already verified: ${email}`);
        throw AppError.badRequest('Email is already verified');
      }

      const emailVerification = await this.authRepository.findEmailVerificationTokenByUserId(user.id);
      const token = this.generateCryptoToken();
      const expiresAt = new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000); // 1 hour
      if (emailVerification) {
        await this.authRepository.updateEmailVerificationToken({
          userId: user.id,
          token,
          expiresAt,
        });
        this.logger.log(`Updated email verification token for user ID: ${user.id}`);
      } else {
        await this.authRepository.createEmailVerificationToken({
          userId: user.id,
          token,
          expiresAt,
        });
        this.logger.log(`Created email verification token for user ID: ${user.id}`);
      }
      this.sendVerificationEmail(user.email, token, user.name);

      return { success: true, message: 'Confirmation email resent successfully' };
    } catch (error) {
      this.logger.error(`Error during resending confirmation email: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to resend confirmation email');
    }
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<AuthResponse> {
    const { token, clientInfo } = data;
    this.logger.log(`Verifying email with token: ${token.slice(0, 8)}...`);
    try {
      // Find the email verification record
      const emailVerification = await this.authRepository.findEmailVerificationTokenByToken(token);
      if (!emailVerification) {
        this.logger.warn(`Invalid email verification token: ${token.slice(0, 8)}...`);
        throw AppError.badRequest('Invalid or expired email verification token');
      }
      if (emailVerification.expiresAt <= new Date()) {
        this.logger.warn(`Expired email verification token: ${token.slice(0, 8)}...`);
        throw AppError.badRequest('Invalid or expired email verification token');
      }
      if (emailVerification.verifiedAt) {
        this.logger.warn(`Email already verified for token: ${token.slice(0, 8)}...`);
        throw AppError.badRequest('Email is already verified');
      }

      // Update the email verification record
      await this.authRepository.updateEmailVerificationToken({
        userId: emailVerification.userId,
        token: '',
        verifiedAt: new Date(),
      });

      // Generate JWT tokens
      const { accessToken, refreshToken } = await this.tokenService.generateJwtTokens({
        userId: emailVerification.userId,
        isBanned: emailVerification.user.isBanned,
        role: convertEnum(UserRole, emailVerification.user.role),
        sid: crypto.randomUUID(),
      });

      // Update user's isEmailVerified status
      const updatedUser = await this.userRepository.updateUser({
        id: emailVerification.userId,
        data: { isEmailVerified: true },
      });

      // Register device so first signIn doesn't trigger a "new device" notification
      if (clientInfo?.ipAddress && clientInfo?.userAgent) {
        const deviceId = this.deviceService.generateDeviceId(clientInfo.ipAddress, clientInfo.userAgent);
        const result = new UAParser(clientInfo.userAgent).getResult();
        await this.deviceService.registerDevice(emailVerification.userId, {
          deviceId,
          ipAddress: clientInfo.ipAddress,
          userAgent: result.ua,
        });
        this.logger.log(`Device registered during email verification for user ${emailVerification.userId}`);
      }

      this.logger.log(`Email verified for user ID: ${emailVerification.userId}`);
      return {
        accessToken,
        refreshToken,
        user: {
          ...updatedUser,
          role: convertEnum(UserRole, updatedUser.role),
        },
      };
    } catch (error) {
      this.logger.error(`Error during email verification: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to verify email');
    }
  }

  async signIn(data: SignInRequest): Promise<AuthResponse> {
    const email = data.email.toLowerCase();
    this.logger.log(`Signing in user with email: ${email}`);

    try {
      // Check if account is locked (does NOT increment counter)
      await this.rateLimiterService.checkLockout('sign_in', email);

      // Find the user by email (use lowercased email consistently)
      const user = await this.userRepository.findUserByEmail(email);
      if (!user) {
        // Record failed attempt even for non-existent users (prevents user enumeration timing attacks)
        await this.rateLimiterService.recordFailedAttempt('sign_in', email, this.LOGIN_RATE_LIMIT);
        this.logger.warn(`User not found with email: ${email}`);
        throw AppError.unauthorized('Invalid email or password');
      }

      // Check if user is banned
      if (user.isBanned) {
        throw AppError.forbidden('User is banned');
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        const emailVerification = await this.authRepository.findEmailVerificationTokenByUserId(user.id);
        if (!emailVerification) {
          const token = this.generateCryptoToken();
          await this.authRepository.createEmailVerificationToken({
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000),
          });
          this.sendVerificationEmail(user.email, token, user.name);
          this.logger.log(`Resent email verification token for user ID: ${user.id}`);
          throw AppError.unauthorized('Email not verified. Verification email resent.');
        }
        if (emailVerification.expiresAt <= new Date()) {
          const token = this.generateCryptoToken();
          await this.authRepository.updateEmailVerificationToken({
            userId: user.id,
            token,
            expiresAt: new Date(Date.now() + this.EMAIL_TOKEN_TTL * 1000),
          });
          this.sendVerificationEmail(user.email, token, user.name);
          this.logger.log(`Resent expired email verification token for user ID: ${user.id}`);
          throw AppError.unauthorized('Email not verified. Verification email resent.');
        }
        this.logger.warn(`Email not verified for user with email: ${email}`);
        throw AppError.unauthorized('Email not verified. Please check your email for verification link.');
      }

      // Verify password — OAuth users have no password hash
      if (!user.passwordHash) {
        throw AppError.unauthorized('This account uses social login. Please sign in with Google or GitHub.');
      }
      const isPasswordValid = await this.hashService.compare(data.password, user.passwordHash);
      if (!isPasswordValid) {
        // Record failed attempt ONLY on wrong password
        const { attemptsLeft, isLocked } = await this.rateLimiterService.recordFailedAttempt(
          'sign_in',
          email,
          this.LOGIN_RATE_LIMIT,
        );

        if (isLocked) {
          const lockoutMinutes = Math.ceil(this.LOGIN_RATE_LIMIT.lockoutSeconds / 60);
          this.sendAccountLockedEmail(user.email, user.name, lockoutMinutes);
          this.logger.warn(`Account locked for user: ${user.id} after too many failed attempts`);
          throw AppError.tooManyRequests(
            `Account locked due to too many failed attempts. Please try again in ${lockoutMinutes} minutes.`,
          );
        }

        this.logger.warn(`Invalid password for user with email: ${email}`);
        throw AppError.unauthorized(
          `Invalid email or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`,
        );
      }

      // Clear any previous rate limit records on successful login
      await this.rateLimiterService.resetRateLimit('sign_in', email);

      // Check for new device and send notification if needed
      const clientInfo = data.clientInfo;
      if (clientInfo?.ipAddress && clientInfo?.userAgent) {
        const deviceId = this.deviceService.generateDeviceId(clientInfo.ipAddress, clientInfo.userAgent);
        const isKnownDevice = await this.deviceService.isKnownDevice(user.id, deviceId);

        if (!isKnownDevice) {
          const result = new UAParser(clientInfo.userAgent).getResult();
          const geo = geoip.lookup(clientInfo.ipAddress);
          // New device detected - send notification email
          this.sendNewLoginNotificationEmail(user.email, user.name, {
            ipAddress: clientInfo.ipAddress,
            userAgent: result.ua,
            timestamp: new Date(),
            location: geo ? `${geo.city}, ${geo.country}` : 'Unknown',
          });

          // Register the new device
          await this.deviceService.registerDevice(user.id, {
            deviceId,
            ipAddress: clientInfo.ipAddress,
            userAgent: result.ua,
          });

          this.logger.log(`New device login detected for user ${user.id}, notification sent`);
        } else {
          // Update last used timestamp for known device
          await this.deviceService.updateDeviceLastUsed(user.id, deviceId);
        }
      }

      // Update last login timestamp
      await this.userRepository.updateUser({
        id: user.id,
        data: { lastLoginAt: new Date() },
      });

      // Generate JWT tokens
      const { accessToken, refreshToken } = await this.tokenService.generateJwtTokens({
        userId: user.id,
        isBanned: user.isBanned,
        role: convertEnum(UserRole, user.role),
        sid: crypto.randomUUID(),
      });

      this.logger.log(`User signed in with ID: ${user.id}`);
      return {
        accessToken,
        refreshToken,
        user: {
          ...user,
          role: convertEnum(UserRole, user.role),
        },
      };
    } catch (error) {
      this.logger.error(`Error during sign in: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to sign in');
    }
  }

  async refreshTokens(token: string): Promise<RefreshTokensResponse> {
    this.logger.log(`Refreshing token`);
    if (!token) {
      this.logger.warn(`No refresh token provided`);
      throw AppError.unauthorized('No refresh token provided');
    }
    try {
      // Verify the provided token
      const payload = await this.tokenService.verifyJwtToken<{ sub: string; isBanned: boolean; sid: string }>(token);
      if (!payload || !payload.sub) {
        this.logger.warn(`Invalid refresh token`);
        throw AppError.unauthorized('Invalid refresh token');
      }

      // Find the user
      const user = await this.userRepository.findUserById(payload.sub);
      if (!user) {
        this.logger.warn(`User not found with ID: ${payload.sub}`);
        throw AppError.unauthorized('Invalid refresh token');
      }

      // Retrieve the stored refresh token hash from Redis
      const key = this.tokenService.refreshKey(payload.sub, payload.sid);
      this.logger.log(`Retrieving refresh token hash from Redis with key: ${key}`);
      const storedHash = await this.redisService.get(key);
      if (!storedHash) {
        this.logger.warn(`No refresh token hash found in Redis for user ID: ${user.id}`);
        throw AppError.unauthorized('Invalid token');
      }

      // Check if user is banned
      if (user.isBanned) {
        await this.redisService.del(key);
        this.logger.warn(`User is banned with ID: ${user.id}`);
        throw AppError.forbidden('User is banned');
      }

      // Verify the refresh token hash
      const isValid = await this.hashService.validate(token, storedHash);

      // Delete the old refresh token from Redis
      await this.redisService.del(key);

      if (!isValid) {
        this.logger.warn('Invalid token');
        throw AppError.unauthorized('Invalid token');
      }

      // Generate new JWT tokens
      const { accessToken, refreshToken } = await this.tokenService.generateJwtTokens({
        userId: user.id,
        isBanned: user.isBanned,
        role: convertEnum(UserRole, user.role),
        sid: crypto.randomUUID(),
      });

      this.logger.log(`Tokens refreshed for user ID: ${user.id}`);
      return {
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(`Error during token refresh: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to refresh token');
    }
  }

  async initResetPassword(rawEmail: string): Promise<StatusResponse> {
    const email = rawEmail.toLowerCase();
    this.logger.log(`Initiating password reset for email: ${email}`);
    try {
      // Check rate limit for password reset initiation
      await this.rateLimiterService.checkRateLimit('password_reset_initiate', email, this.PASSWORD_RESET_RATE_LIMIT);

      // Find the user by email
      const user = await this.userRepository.findUserByEmail(email);
      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        throw AppError.badRequest('User with the provided email does not exist');
      }
      if (!user.isEmailVerified) {
        this.logger.warn(`Email not verified for user with email: ${email}`);
        throw AppError.badRequest('Email is not verified');
      }

      // Check if a password reset token already exists for the user
      const existingToken = await this.authRepository.findPasswordResetTokenByUserId(user.id);
      if (existingToken && existingToken.expiresAt > new Date()) {
        this.logger.log(`Existing valid password reset token found for user ID: ${user.id}`);
        return { success: true, message: 'Password reset token already exists. Please check your email.' };
      }

      // Create a new password reset token
      const token = this.generateCryptoToken();
      if (existingToken) {
        await this.authRepository.updatePasswordResetTokenById({
          id: existingToken.id,
          token,
          expiresAt: new Date(Date.now() + this.PASSWORD_RESET_TOKEN_TTL * 1000), // 1 hour
        });
        this.logger.log(`Updated password reset token for user ID: ${user.id}`);
      } else {
        await this.authRepository.createPasswordResetToken({
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + this.PASSWORD_RESET_TOKEN_TTL * 1000), // 1 hour
        });
        this.logger.log(`Created password reset token for user ID: ${user.id}`);
      }

      // Send password reset email
      this.sendPasswordResetEmail(user.email, token, user.name);
      this.logger.log(`Password reset email sent to user ID: ${user.id}`);

      return { success: true, message: 'Password reset token generated successfully' };
    } catch (error) {
      this.logger.error(`Error during password reset initiation: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to initiate password reset');
    }
  }

  async resendResetPasswordEmail(rawEmail: string): Promise<StatusResponse> {
    const email = rawEmail.toLowerCase();
    this.logger.log(`Resending password reset email to: ${email}`);
    try {
      // Check rate limit for resending password reset email
      await this.rateLimiterService.checkRateLimit('password_reset_resend', email, this.EMAIL_RESEND_RATE_LIMIT);

      const user = await this.userRepository.findUserByEmail(email);
      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        throw AppError.badRequest('User with the provided email does not exist');
      }
      if (!user.isEmailVerified) {
        this.logger.warn(`Email not verified for user with email: ${email}`);
        throw AppError.badRequest('Email is not verified');
      }

      // Find existing password reset token
      const passwordReset = await this.authRepository.findPasswordResetTokenByUserId(user.id);
      if (!passwordReset || passwordReset.expiresAt <= new Date()) {
        this.logger.warn(`No valid password reset token found for user ID: ${user.id}`);
        throw AppError.badRequest('No valid password reset token found. Please initiate password reset again.');
      }

      // Generate a fresh token to invalidate any previously intercepted token
      const newToken = this.generateCryptoToken();
      await this.authRepository.updatePasswordResetTokenById({
        id: passwordReset.id,
        token: newToken,
        expiresAt: new Date(Date.now() + this.PASSWORD_RESET_TOKEN_TTL * 1000),
      });

      // Send password reset email with the new token
      this.sendPasswordResetEmail(user.email, newToken, user.name);
      this.logger.log(`Password reset email resent with new token to user ID: ${user.id}`);

      return { success: true, message: 'Password reset email resent successfully' };
    } catch (error) {
      this.logger.error(
        `Error during resending password reset email: ${error instanceof Error ? error.message : error}`,
      );
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to resend password reset email');
    }
  }

  async setNewPassword(data: SetNewPasswordRequest): Promise<StatusResponse> {
    const { token, password } = data;
    this.logger.log(`Setting new password with token: ${token.slice(0, 8)}...`);
    try {
      // Find the password reset record
      const passwordReset = await this.authRepository.findPasswordResetTokenByToken(token);
      if (!passwordReset) {
        this.logger.warn(`Invalid password reset token: ${token.slice(0, 8)}...`);
        throw AppError.badRequest('Invalid or expired password reset token');
      }
      if (passwordReset.expiresAt <= new Date()) {
        this.logger.warn(`Expired password reset token: ${token.slice(0, 8)}...`);
        throw AppError.badRequest('Invalid or expired password reset token');
      }

      // find the user
      const user = await this.userRepository.findUserById(passwordReset.userId);
      if (!user) {
        this.logger.warn(`User not found with ID: ${passwordReset.userId}`);
        throw AppError.badRequest('Invalid password reset token');
      }

      // Ensure the new password is different from the old one — OAuth users have no password hash
      if (!user.passwordHash) {
        throw AppError.badRequest('This account uses social login and has no password to reset.');
      }
      await this.hashService.theSame(password, user.passwordHash);

      // Hash the new password
      const passwordHash = await this.hashService.create(password);

      // Update the user's password
      await this.userRepository.updateUser({
        id: passwordReset.userId,
        data: { passwordHash },
      });

      // Invalidate the used password reset token
      await this.authRepository.updatePasswordResetTokenById({
        id: passwordReset.id,
        token: '',
        changedAt: new Date(),
      });

      // Invalidate all existing refresh tokens for the user
      const keys = await this.scanRedisKeys(`refresh:${passwordReset.userId}:*`);
      if (keys.length > 0) {
        await this.redisService.del(...keys);
        this.logger.log(`Invalidated ${keys.length} refresh tokens for user ID: ${passwordReset.userId}`);
      }

      // Clear all known devices (user must re-authenticate on all devices)
      await this.deviceService.removeAllDevices(passwordReset.userId);

      // Reset rate limit for password reset attempts
      await this.rateLimiterService.resetRateLimit('password_reset', user.email);

      // send a confirmation email about password change
      this.sendPasswordResetConfirmationEmail(user.email, user.name);

      this.logger.log(`Password reset successfully for user ID: ${passwordReset.userId}`);
      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error(`Error during setting new password: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to set new password');
    }
  }

  async signOutCurrentDevice(data: SignOutRequest): Promise<StatusResponse> {
    const { userId, currentSessionId } = data;
    this.logger.log(`Logging out user from current device: ${userId}, session ID: ${currentSessionId}`);
    try {
      const key = `refresh:${userId}:${currentSessionId}`;
      await this.redisService.del(key);
      this.logger.log(`Invalidated refresh token for user ID: ${userId}, session ID: ${currentSessionId}`);
      return { success: true, message: 'Successfully logged out from current device' };
    } catch (error) {
      this.logger.error(`Error during logout current device: ${error instanceof Error ? error.message : error}`);
      throw AppError.internalServerError('Failed to logout from current device');
    }
  }

  async signOutOtherDevices(data: SignOutRequest): Promise<StatusResponse> {
    this.logger.log(`Logging out user from other devices: ${data.userId}`);

    try {
      const keys = await this.scanRedisKeys(`refresh:${data.userId}:*`);
      const currentKey = `refresh:${data.userId}:${data.currentSessionId}`;

      // Filter out current session
      const keysToDelete = keys.filter((key) => key !== currentKey);

      if (keysToDelete.length > 0) {
        await this.redisService.del(...keysToDelete);
        this.logger.log(`Invalidated ${keysToDelete.length} other sessions for user ID: ${data.userId}`);
      }

      return {
        success: true,
        message: `Successfully logged out from ${keysToDelete.length} other device${keysToDelete.length !== 1 ? 's' : ''}.`,
      };
    } catch (error) {
      this.logger.error(`Error during logout other devices: ${error instanceof Error ? error.message : error}`);
      throw AppError.internalServerError('Failed to logout from other devices');
    }
  }

  async signOutAllDevices(userId: string): Promise<StatusResponse> {
    this.logger.log(`Logging out user from all devices: ${userId}`);

    try {
      // Find and delete all refresh tokens for this user
      const keys = await this.scanRedisKeys(`refresh:${userId}:*`);

      if (keys.length > 0) {
        await this.redisService.del(...keys);
        this.logger.log(`Invalidated ${keys.length} sessions for user ID: ${userId}`);
      }

      return {
        success: true,
        message: `Successfully logged out from ${keys.length} device${keys.length !== 1 ? 's' : ''}.`,
      };
    } catch (error) {
      this.logger.error(`Error during logout all devices: ${error instanceof Error ? error.message : error}`);
      throw AppError.internalServerError('Failed to logout from all devices');
    }
  }

  async oauthSignIn(data: OAuthSignInRequest): Promise<AuthResponse> {
    this.logger.log(`OAuth sign in for provider: ${data.provider}, providerId: ${data.providerId}`);
    try {
      // 1. Rate limit by IP to prevent account enumeration and resource abuse
      if (data.clientInfo?.ipAddress) {
        await this.rateLimiterService.checkRateLimit('oauth_signin', data.clientInfo.ipAddress, this.OAUTH_RATE_LIMIT);
      }

      // 2. Look up existing OAuth account
      const oauthAccount = await this.authRepository.findOAuthAccount(data.provider, data.providerId);

      let user: PrismaUser;

      if (oauthAccount) {
        // Known OAuth account — load the linked user
        const found = await this.userRepository.findUserById(oauthAccount.userId);
        if (!found) {
          this.logger.error(`User not found for OAuth account: ${oauthAccount.userId}`);
          throw AppError.internalServerError('User not found');
        }
        user = found;
      } else {
        // No OAuth account yet — find by email or create a new user
        const email = data.email?.toLowerCase();
        if (!email) {
          throw AppError.badRequest('Email is required for OAuth sign in');
        }

        const existingUser = await this.userRepository.findUserByEmail(email);
        if (!existingUser) {
          user = await this.userRepository.createOAuthUser({
            email,
            name: data.name,
            avatarUrl: data.avatarUrl,
          });
          this.logger.log(`Created new OAuth user with ID: ${user.id}`);
        } else {
          // Existing email/password user — ensure their email is marked verified
          // since the OAuth provider has already confirmed it
          if (!existingUser.isEmailVerified) {
            user = await this.userRepository.updateUser({
              id: existingUser.id,
              data: { isEmailVerified: true },
            });
          } else {
            user = existingUser;
          }
          this.logger.log(`Linking OAuth account to existing user ID: ${user.id}`);
        }

        // Link OAuth account to the user
        await this.authRepository.createOAuthAccount({
          userId: user.id,
          provider: data.provider,
          providerId: data.providerId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });
      }

      // 3. Check if banned
      if (user.isBanned) {
        throw AppError.forbidden('User is banned');
      }

      // 4. Handle device tracking (same as signIn)
      const clientInfo = data.clientInfo;
      if (clientInfo?.ipAddress && clientInfo?.userAgent) {
        const deviceId = this.deviceService.generateDeviceId(clientInfo.ipAddress, clientInfo.userAgent);
        const isKnownDevice = await this.deviceService.isKnownDevice(user.id, deviceId);
        const result = new UAParser(clientInfo.userAgent).getResult();

        if (!isKnownDevice) {
          const geo = geoip.lookup(clientInfo.ipAddress);
          this.sendNewLoginNotificationEmail(user.email, user.name, {
            ipAddress: clientInfo.ipAddress,
            userAgent: result.ua,
            timestamp: new Date(),
            location: geo ? `${geo.city}, ${geo.country}` : 'Unknown',
          });
          await this.deviceService.registerDevice(user.id, {
            deviceId,
            ipAddress: clientInfo.ipAddress,
            userAgent: result.ua,
          });
        } else {
          await this.deviceService.updateDeviceLastUsed(user.id, deviceId);
        }
      }

      // 5. Update last login timestamp
      await this.userRepository.updateUser({ id: user.id, data: { lastLoginAt: new Date() } });

      // 6. Generate JWT tokens
      const { accessToken, refreshToken } = await this.tokenService.generateJwtTokens({
        userId: user.id,
        isBanned: user.isBanned,
        role: convertEnum(UserRole, user.role),
        sid: crypto.randomUUID(),
      });

      this.logger.log(`OAuth sign in successful for user ID: ${user.id}`);
      return {
        accessToken,
        refreshToken,
        user: {
          ...user,
          role: convertEnum(UserRole, user.role),
        },
      };
    } catch (error) {
      this.logger.error(`Error during OAuth sign in: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to OAuth sign in');
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';

import type { EmailVerificationToken, PasswordResetToken, User } from 'prisma/generated-types/client';

interface EmailVerificationTokenWithUser extends EmailVerificationToken {
  user: User;
}

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  // Find email verification token by token string
  async findEmailVerificationTokenByToken(token: string): Promise<EmailVerificationTokenWithUser | null> {
    this.logger.log(`Finding email verification token: ${token}`);
    return await this.prisma.emailVerificationToken.findFirst({
      where: { token },
      include: { user: true },
    });
  }

  // Find verification token by user ID
  async findEmailVerificationTokenByUserId(userId: string): Promise<EmailVerificationToken | null> {
    this.logger.log(`Finding email verification token for user ID: ${userId}`);
    return await this.prisma.emailVerificationToken.findUnique({
      where: { userId },
    });
  }

  // Create email verification token
  async createEmailVerificationToken({
    userId,
    token,
    expiresAt,
  }: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<EmailVerificationToken> {
    this.logger.log(`Creating email verification token for user ID: ${userId}`);
    return await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  // Update email verification token
  async updateEmailVerificationToken({
    userId,
    token,
    expiresAt,
    verifiedAt,
  }: {
    userId: string;
    token: string;
    expiresAt?: Date;
    verifiedAt?: Date;
  }): Promise<EmailVerificationToken | null> {
    this.logger.log(`Updating email verification token for user ID: ${userId}`);
    return await this.prisma.emailVerificationToken.update({
      where: { userId },
      data: {
        token,
        expiresAt,
        verifiedAt,
      },
    });
  }

  // Find password reset token by token string
  async findPasswordResetTokenByToken(token: string): Promise<PasswordResetToken | null> {
    this.logger.log(`Finding password reset token: ${token}`);
    return await this.prisma.passwordResetToken.findFirst({
      where: { token },
    });
  }

  // Find password reset token by user ID
  async findPasswordResetTokenByUserId(userId: string): Promise<PasswordResetToken | null> {
    this.logger.log(`Finding password reset token for user ID: ${userId}`);
    return await this.prisma.passwordResetToken.findFirst({
      where: { userId },
    });
  }

  // create password reset token
  async createPasswordResetToken({
    userId,
    token,
    expiresAt,
  }: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    this.logger.log(`Creating password reset token for user ID: ${userId}`);
    return await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  // Update password reset token by ID
  async updatePasswordResetTokenById({
    id,
    token,
    changedAt,
    expiresAt,
  }: {
    id: string;
    token: string;
    changedAt?: Date;
    expiresAt?: Date;
  }): Promise<PasswordResetToken | null> {
    this.logger.log(`Updating password reset token ID: ${id}`);
    return await this.prisma.passwordResetToken.update({
      where: { id },
      data: {
        token,
        changedAt,
        expiresAt,
      },
    });
  }
}

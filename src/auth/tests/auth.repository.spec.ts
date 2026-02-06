import { Test, TestingModule } from '@nestjs/testing';

import { AuthRepository } from '../auth.repository';
import { PrismaService } from 'src/prisma/prisma.service';

const prismaMock = {
  emailVerificationToken: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordResetToken: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('AuthRepository', () => {
  let repository: AuthRepository;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    role: 'USER',
    isEmailVerified: false,
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };

  const mockEmailVerificationToken = {
    id: 'verification-123',
    userId: 'user-123',
    token: 'verification-token',
    expiresAt: new Date(Date.now() + 3600000),
    verifiedAt: null,
    createdAt: new Date(),
  };

  const mockEmailVerificationTokenWithUser = {
    ...mockEmailVerificationToken,
    user: mockUser,
  };

  const mockPasswordResetToken = {
    id: 'reset-123',
    userId: 'user-123',
    token: 'reset-token',
    expiresAt: new Date(Date.now() + 3600000),
    changedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findEmailVerificationTokenByToken', () => {
    it('should find email verification token by token string and include user', async () => {
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue(mockEmailVerificationTokenWithUser);

      const result = await repository.findEmailVerificationTokenByToken('verification-token');

      expect(prismaMock.emailVerificationToken.findFirst).toHaveBeenCalledWith({
        where: { token: 'verification-token' },
        include: { user: true },
      });
      expect(result).toEqual(mockEmailVerificationTokenWithUser);
      expect(result?.user).toEqual(mockUser);
    });

    it('should return null if token not found', async () => {
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue(null);

      const result = await repository.findEmailVerificationTokenByToken('non-existent-token');

      expect(prismaMock.emailVerificationToken.findFirst).toHaveBeenCalledWith({
        where: { token: 'non-existent-token' },
        include: { user: true },
      });
      expect(result).toBeNull();
    });
  });

  describe('findEmailVerificationTokenByUserId', () => {
    it('should find email verification token by user ID', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue(mockEmailVerificationToken);

      const result = await repository.findEmailVerificationTokenByUserId('user-123');

      expect(prismaMock.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(result).toEqual(mockEmailVerificationToken);
    });

    it('should return null if user has no verification token', async () => {
      prismaMock.emailVerificationToken.findUnique.mockResolvedValue(null);

      const result = await repository.findEmailVerificationTokenByUserId('non-existent-user');

      expect(prismaMock.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { userId: 'non-existent-user' },
      });
      expect(result).toBeNull();
    });
  });

  describe('createEmailVerificationToken', () => {
    it('should create email verification token with correct data', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      prismaMock.emailVerificationToken.create.mockResolvedValue({
        ...mockEmailVerificationToken,
        expiresAt,
      });

      const result = await repository.createEmailVerificationToken({
        userId: 'user-123',
        token: 'verification-token',
        expiresAt,
      });

      expect(prismaMock.emailVerificationToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: 'verification-token',
          expiresAt,
        },
      });
      expect(result.userId).toBe('user-123');
      expect(result.token).toBe('verification-token');
    });
  });

  describe('updateEmailVerificationToken', () => {
    it('should update email verification token with new token and expiresAt', async () => {
      const newExpiresAt = new Date(Date.now() + 7200000);
      prismaMock.emailVerificationToken.update.mockResolvedValue({
        ...mockEmailVerificationToken,
        token: 'new-verification-token',
        expiresAt: newExpiresAt,
      });

      const result = await repository.updateEmailVerificationToken({
        userId: 'user-123',
        token: 'new-verification-token',
        expiresAt: newExpiresAt,
      });

      expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          token: 'new-verification-token',
          expiresAt: newExpiresAt,
          verifiedAt: undefined,
        },
      });
      expect(result?.token).toBe('new-verification-token');
    });

    it('should update email verification token with verifiedAt', async () => {
      const verifiedAt = new Date();
      prismaMock.emailVerificationToken.update.mockResolvedValue({
        ...mockEmailVerificationToken,
        token: '',
        verifiedAt,
      });

      const result = await repository.updateEmailVerificationToken({
        userId: 'user-123',
        token: '',
        verifiedAt,
      });

      expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          token: '',
          expiresAt: undefined,
          verifiedAt,
        },
      });
      expect(result?.verifiedAt).toEqual(verifiedAt);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create password reset token with correct data', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      prismaMock.passwordResetToken.create.mockResolvedValue({
        ...mockPasswordResetToken,
        expiresAt,
      });

      const result = await repository.createPasswordResetToken({
        userId: 'user-123',
        token: 'reset-token',
        expiresAt,
      });

      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          token: 'reset-token',
          expiresAt,
        },
      });
      expect(result.userId).toBe('user-123');
      expect(result.token).toBe('reset-token');
    });
  });

  describe('findPasswordResetTokenByToken', () => {
    it('should find password reset token by token string', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(mockPasswordResetToken);

      const result = await repository.findPasswordResetTokenByToken('reset-token');

      expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: { token: 'reset-token' },
      });
      expect(result).toEqual(mockPasswordResetToken);
    });

    it('should return null if token not found', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await repository.findPasswordResetTokenByToken('non-existent-token');

      expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: { token: 'non-existent-token' },
      });
      expect(result).toBeNull();
    });
  });

  describe('findPasswordResetTokenByUserId', () => {
    it('should find password reset token by user ID', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(mockPasswordResetToken);

      const result = await repository.findPasswordResetTokenByUserId('user-123');

      expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
      expect(result).toEqual(mockPasswordResetToken);
    });

    it('should return null if user has no password reset token', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);

      const result = await repository.findPasswordResetTokenByUserId('non-existent-user');

      expect(prismaMock.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: { userId: 'non-existent-user' },
      });
      expect(result).toBeNull();
    });
  });

  describe('updatePasswordResetTokenById', () => {
    it('should update password reset token with new token and expiresAt', async () => {
      const newExpiresAt = new Date(Date.now() + 7200000);
      prismaMock.passwordResetToken.update.mockResolvedValue({
        ...mockPasswordResetToken,
        token: 'new-reset-token',
        expiresAt: newExpiresAt,
      });

      const result = await repository.updatePasswordResetTokenById({
        id: 'reset-123',
        token: 'new-reset-token',
        expiresAt: newExpiresAt,
      });

      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-123' },
        data: {
          token: 'new-reset-token',
          changedAt: undefined,
          expiresAt: newExpiresAt,
        },
      });
      expect(result?.token).toBe('new-reset-token');
    });

    it('should update password reset token with changedAt to invalidate token', async () => {
      const changedAt = new Date();
      prismaMock.passwordResetToken.update.mockResolvedValue({
        ...mockPasswordResetToken,
        token: '',
        changedAt,
      });

      const result = await repository.updatePasswordResetTokenById({
        id: 'reset-123',
        token: '',
        changedAt,
      });

      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-123' },
        data: {
          token: '',
          changedAt,
          expiresAt: undefined,
        },
      });
      expect(result?.changedAt).toEqual(changedAt);
    });
  });
});

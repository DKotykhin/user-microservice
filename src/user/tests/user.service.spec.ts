import { Test, TestingModule } from '@nestjs/testing';

import { UserService } from '../user.service';
import { UserRepository } from '../user.repository';
import { HashService } from 'src/hash/hash.service';
import { AppError } from 'src/utils/errors/app-error';
import { UserRole } from 'src/generated-types/user';

describe('UserService', () => {
  let service: UserService;

  const baseUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: 'hash',
    role: 'USER',
    isBanned: false,
    name: 'Test User',
  };

  const hashServiceMock = {
    compare: jest.fn(),
    same: jest.fn(),
    create: jest.fn(),
  };

  const userRepositoryMock = {
    findUserById: jest.fn(),
    getAllUsers: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getBannedUsers: jest.fn(),
    getBanDetailsByUserId: jest.fn(),
    createBanDetails: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: HashService, useValue: hashServiceMock },
        { provide: UserRepository, useValue: userRepositoryMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);

      const result = await service.getUserById('user-1');

      expect(result.id).toBe('user-1');
      expect(result.role).toBe(UserRole.USER);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.getUserById('user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserById('user-1')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('getAllUsers', () => {
    const paginationInput = { page: 1, limit: 25, totalItems: 0, totalPages: 0 };

    it('should return all users with pagination meta', async () => {
      const users = [
        { ...baseUser, id: 'user-1' },
        { ...baseUser, id: 'user-2' },
      ];
      const meta = { page: 1, limit: 25, totalItems: 2, totalPages: 1 };
      userRepositoryMock.getAllUsers.mockResolvedValue({ users, meta });

      const result = await service.getAllUsers(paginationInput);

      expect(result.users.length).toBe(2);
      expect(result.users[0].role).toBe(UserRole.USER);
      expect(result.meta).toEqual(meta);
    });

    it('should convert user roles correctly', async () => {
      const users = [
        { ...baseUser, id: 'user-1', role: 'ADMIN' },
        { ...baseUser, id: 'user-2', role: 'USER' },
      ];
      const meta = { page: 1, limit: 25, totalItems: 2, totalPages: 1 };
      userRepositoryMock.getAllUsers.mockResolvedValue({ users, meta });

      const result = await service.getAllUsers(paginationInput);

      expect(result.users[0].role).toBe(UserRole.ADMIN);
      expect(result.users[1].role).toBe(UserRole.USER);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.getAllUsers.mockRejectedValue(new Error('DB error'));

      await expect(service.getAllUsers(paginationInput)).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('updateUser', () => {
    it('should update and return user', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.updateUser.mockResolvedValue({
        ...baseUser,
        name: 'New Name',
      });

      const result = await service.updateUser({
        id: 'user-1',
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(userRepositoryMock.updateUser).toHaveBeenCalled();
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.updateUser({ id: 'user-1', name: 'New Name' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.updateUser.mockRejectedValue(new Error('DB error'));

      await expect(service.updateUser({ id: 'user-1', name: 'New Name' })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);

      const result = await service.deleteUser('user-1');

      expect(userRepositoryMock.deleteUser).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.deleteUser('user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.deleteUser.mockRejectedValue(new Error('DB error'));

      await expect(service.deleteUser('user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('should rethrow AppError from repository', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.deleteUser.mockRejectedValue(AppError.badRequest('Custom error'));

      await expect(service.deleteUser('user-1')).rejects.toThrow('Custom error');
    });
  });

  describe('confirmPassword', () => {
    it('should confirm password', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      hashServiceMock.compare.mockResolvedValue(true);

      const result = await service.confirmPassword({
        id: 'user-1',
        password: 'password',
      });

      expect(result.success).toBe(true);
    });

    it('should throw if password is invalid', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      hashServiceMock.compare.mockResolvedValue(false);

      await expect(service.confirmPassword({ id: 'user-1', password: 'wrong' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.confirmPassword({ id: 'user-1', password: 'password' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      hashServiceMock.compare.mockRejectedValue(new Error('Hash error'));

      await expect(service.confirmPassword({ id: 'user-1', password: 'password' })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);

      hashServiceMock.same.mockResolvedValue(false);
      hashServiceMock.create.mockResolvedValue('new-hash');

      userRepositoryMock.updateUser.mockResolvedValue({
        ...baseUser,
        passwordHash: 'new-hash',
      });

      const result = await service.changePassword({
        id: 'user-1',
        password: 'new-password',
      });

      expect(hashServiceMock.same).toHaveBeenCalledWith('new-password', baseUser.passwordHash);

      expect(hashServiceMock.create).toHaveBeenCalledWith('new-password');

      expect(userRepositoryMock.updateUser).toHaveBeenCalledWith({
        id: 'user-1',
        data: { passwordHash: 'new-hash' },
      });

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
    });

    it('should throw if new password is same as old password', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);

      hashServiceMock.same.mockRejectedValue(AppError.badRequest('New password must be different from the old one'));

      await expect(
        service.changePassword({
          id: 'user-1',
          password: 'same-password',
        }),
      ).rejects.toBeInstanceOf(AppError);

      expect(userRepositoryMock.updateUser).not.toHaveBeenCalled();
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.changePassword({ id: 'user-1', password: 'new-password' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      hashServiceMock.same.mockResolvedValue(false);
      hashServiceMock.create.mockResolvedValue('new-hash');
      userRepositoryMock.updateUser.mockRejectedValue(new Error('DB error'));

      await expect(service.changePassword({ id: 'user-1', password: 'new-password' })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('banUser', () => {
    it('should ban user', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.createBanDetails.mockResolvedValue({});
      userRepositoryMock.updateUser.mockResolvedValue({
        ...baseUser,
        isBanned: true,
      });

      const result = await service.banUser({
        id: 'user-1',
        bannedBy: 'admin',
      });

      expect(result.isBanned).toBe(true);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.banUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw if user is already banned', async () => {
      userRepositoryMock.findUserById.mockResolvedValue({
        ...baseUser,
        isBanned: true,
      });

      await expect(service.banUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.createBanDetails.mockRejectedValue(new Error('DB error'));

      await expect(service.banUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('unbanUser', () => {
    it('should unban user', async () => {
      userRepositoryMock.findUserById.mockResolvedValue({
        ...baseUser,
        isBanned: true,
      });
      userRepositoryMock.createBanDetails.mockResolvedValue({});
      userRepositoryMock.updateUser.mockResolvedValue({
        ...baseUser,
        isBanned: false,
      });

      const result = await service.unbanUser({
        id: 'user-1',
        bannedBy: 'admin',
      });

      expect(result.isBanned).toBe(false);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.unbanUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw if user is not banned', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);

      await expect(service.unbanUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue({
        ...baseUser,
        isBanned: true,
      });
      userRepositoryMock.createBanDetails.mockRejectedValue(new Error('DB error'));

      await expect(service.unbanUser({ id: 'user-1', bannedBy: 'admin' })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('getBannedUsers', () => {
    it('should return banned users', async () => {
      userRepositoryMock.getBannedUsers.mockResolvedValue([{ ...baseUser, isBanned: true }]);

      const result = await service.getBannedUsers();

      expect(result.users.length).toBe(1);
      expect(result.users[0].isBanned).toBe(true);
    });
  });

  describe('getBanDetailsByUserId', () => {
    it('should return ban details', async () => {
      userRepositoryMock.getBanDetailsByUserId.mockResolvedValue({
        reason: 'test',
      });

      const result = await service.getBanDetailsByUserId('user-1');

      expect(result.banDetails).toBeDefined();
    });
  });

  describe('changeUserRole', () => {
    it('should change user role', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.updateUser.mockResolvedValue({
        ...baseUser,
        role: 'ADMIN',
      });

      const result = await service.changeUserRole({
        id: 'user-1',
        role: UserRole.ADMIN,
      });

      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('should throw not found if user does not exist', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(null);

      await expect(service.changeUserRole({ id: 'user-1', role: UserRole.ADMIN })).rejects.toBeInstanceOf(AppError);
    });

    it('should throw internal server error on repository failure', async () => {
      userRepositoryMock.findUserById.mockResolvedValue(baseUser);
      userRepositoryMock.updateUser.mockRejectedValue(new Error('DB error'));

      await expect(service.changeUserRole({ id: 'user-1', role: UserRole.ADMIN })).rejects.toBeInstanceOf(AppError);
    });
  });
});

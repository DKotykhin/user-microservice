import { Test, TestingModule } from '@nestjs/testing';

import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { UserRole } from 'src/generated-types/user';
import { GrpcMetricsInterceptor, BusinessMetricsInterceptor } from 'src/supervision/metrics/interceptors';

describe('UserController', () => {
  let controller: UserController;

  const userServiceMock = {
    getUserById: jest.fn(),
    getAllUsers: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    confirmPassword: jest.fn(),
    changePassword: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
    getBannedUsers: jest.fn(),
    getBanDetailsByUserId: jest.fn(),
    changeUserRole: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userServiceMock }],
    })
      .overrideInterceptor(GrpcMetricsInterceptor)
      .useValue({})
      .overrideInterceptor(BusinessMetricsInterceptor)
      .useValue({})
      .compile();

    controller = module.get<UserController>(UserController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserById', () => {
    it('should call userService.getUserById', async () => {
      userServiceMock.getUserById.mockResolvedValue({ id: 'user-1' });

      const result = await controller.getUserById({ id: 'user-1' });

      expect(userServiceMock.getUserById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('getAllUsers', () => {
    it('should call userService.getAllUsers', async () => {
      const paginationData = { page: 1, limit: 25, totalItems: 0, totalPages: 0 };
      const mockResponse = {
        users: [{ id: 'user-1' }, { id: 'user-2' }],
        meta: { page: 1, limit: 25, totalItems: 2, totalPages: 1 },
      };
      userServiceMock.getAllUsers.mockResolvedValue(mockResponse);

      const result = await controller.getAllUsers(paginationData);

      expect(userServiceMock.getAllUsers).toHaveBeenCalledWith(paginationData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateUser', () => {
    it('should call userService.updateUser', async () => {
      const dto = { id: 'user-1', name: 'Updated Name' };
      userServiceMock.updateUser.mockResolvedValue(dto);

      const result = await controller.updateUser(dto);

      expect(userServiceMock.updateUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(dto);
    });
  });

  describe('deleteUser', () => {
    it('should call userService.deleteUser', async () => {
      userServiceMock.deleteUser.mockResolvedValue({ success: true });

      const result = await controller.deleteUser({ id: 'user-1' });

      expect(userServiceMock.deleteUser).toHaveBeenCalledWith('user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('confirmPassword', () => {
    it('should call userService.confirmPassword', async () => {
      const dto = { id: 'user-1', password: 'password' };
      userServiceMock.confirmPassword.mockResolvedValue({ success: true });

      const result = await controller.confirmPassword(dto);

      expect(userServiceMock.confirmPassword).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should call userService.changePassword', async () => {
      const dto = { id: 'user-1', password: 'new-password' };
      userServiceMock.changePassword.mockResolvedValue({ success: true });

      const result = await controller.changePassword(dto);

      expect(userServiceMock.changePassword).toHaveBeenCalledWith(dto);
      expect(result.success).toBe(true);
    });
  });

  describe('banUser', () => {
    it('should call userService.banUser', async () => {
      const dto = { id: 'user-1', bannedBy: 'admin' };
      userServiceMock.banUser.mockResolvedValue({ id: 'user-1', isBanned: true });

      const result = await controller.banUser(dto);

      expect(userServiceMock.banUser).toHaveBeenCalledWith(dto);
      expect(result.isBanned).toBe(true);
    });
  });

  describe('unbanUser', () => {
    it('should call userService.unbanUser', async () => {
      const dto = { id: 'user-1', bannedBy: 'admin' };
      userServiceMock.unbanUser.mockResolvedValue({ id: 'user-1', isBanned: false });

      const result = await controller.unbanUser(dto);

      expect(userServiceMock.unbanUser).toHaveBeenCalledWith(dto);
      expect(result.isBanned).toBe(false);
    });
  });

  describe('getBannedUsers', () => {
    it('should call userService.getBannedUsers', async () => {
      userServiceMock.getBannedUsers.mockResolvedValue({ users: [] });

      const result = await controller.getBannedUsers();

      expect(userServiceMock.getBannedUsers).toHaveBeenCalled();
      expect(result.users).toEqual([]);
    });
  });

  describe('getBanDetailsByUserId', () => {
    it('should call userService.getBanDetailsByUserId', async () => {
      userServiceMock.getBanDetailsByUserId.mockResolvedValue({ banDetails: {} });

      const result = await controller.getBanDetailsByUserId({ id: 'user-1' });

      expect(userServiceMock.getBanDetailsByUserId).toHaveBeenCalledWith('user-1');
      expect(result.banDetails).toBeDefined();
    });
  });

  describe('changeUserRole', () => {
    it('should call userService.changeUserRole', async () => {
      userServiceMock.changeUserRole.mockResolvedValue({
        id: 'user-1',
        role: UserRole.ADMIN,
      });

      const result = await controller.changeUserRole({
        id: 'user-1',
        role: UserRole.ADMIN,
      });

      expect(userServiceMock.changeUserRole).toHaveBeenCalledWith({
        id: 'user-1',
        role: UserRole.ADMIN,
      });
      expect(result.role).toBe(UserRole.ADMIN);
    });
  });
});

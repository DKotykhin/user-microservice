import { Test, TestingModule } from '@nestjs/testing';

import { UserRepository } from '../user.repository';
import { PrismaService } from 'src/prisma/prisma.service';

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  banDetails: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserRepository, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findUserByEmail', () => {
    it('should call prisma.user.findUnique with email', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });

      const result = await repository.findUserByEmail('test@test.com');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
      expect(result?.email).toBe('test@test.com');
    });
  });

  describe('findUserById', () => {
    it('should call prisma.user.findUnique with id', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: '1' });

      const result = await repository.findUserById('1');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result?.id).toBe('1');
    });
  });

  describe('getAllUsers', () => {
    it('should fetch all users with pagination', async () => {
      const users = [
        { id: '1', email: 'user1@test.com' },
        { id: '2', email: 'user2@test.com' },
      ];
      prismaMock.$transaction.mockResolvedValue([users, 2]);

      const result = await repository.getAllUsers({ page: 1, limit: 25 });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result.users).toEqual(users);
      expect(result.meta).toEqual({
        page: 1,
        limit: 25,
        totalItems: 2,
        totalPages: 1,
      });
    });

    it('should handle multiple pages correctly', async () => {
      const users = [{ id: '1', email: 'user1@test.com' }];
      prismaMock.$transaction.mockResolvedValue([users, 50]);

      const result = await repository.getAllUsers({ page: 1, limit: 25 });

      expect(result.meta).toEqual({
        page: 1,
        limit: 25,
        totalItems: 50,
        totalPages: 2,
      });
    });

    it('should calculate correct skip for page 2', async () => {
      const users = [{ id: '3', email: 'user3@test.com' }];
      prismaMock.$transaction.mockResolvedValue([users, 100]);

      const result = await repository.getAllUsers({ page: 2, limit: 10 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        totalItems: 100,
        totalPages: 10,
      });
    });
  });

  describe('createUser', () => {
    it('should create a user with correct data', async () => {
      prismaMock.user.create.mockResolvedValue({ id: '1', email: 'test@test.com' });

      const result = await repository.createUser({
        data: {
          email: 'test@test.com',
          name: 'Test',
          phoneNumber: '123',
          password: 'password',
        },
        passwordHash: 'hash',
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@test.com',
          passwordHash: 'hash',
          name: 'Test',
          phoneNumber: '123',
        },
      });

      expect(result.id).toBe('1');
    });
  });

  describe('updateUser', () => {
    it('should update user', async () => {
      prismaMock.user.update.mockResolvedValue({ id: '1', name: 'New Name' });

      const result = await repository.updateUser({
        id: '1',
        data: { name: 'New Name' },
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'New Name' },
      });
      expect(result.name).toBe('New Name');
    });
  });

  describe('deleteUser', () => {
    it('should delete user by id', async () => {
      prismaMock.user.delete.mockResolvedValue({});

      await repository.deleteUser('1');

      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });

  describe('getBannedUsers', () => {
    it('should fetch banned users', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: '1', isBanned: true }]);

      const result = await repository.getBannedUsers();

      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        where: { isBanned: true },
      });
      expect(result.length).toBe(1);
    });
  });

  describe('getBanDetailsByUserId', () => {
    it('should fetch ban details by user id', async () => {
      prismaMock.banDetails.findMany.mockResolvedValue([{ userId: '1' }]);

      const result = await repository.getBanDetailsByUserId('1');

      expect(prismaMock.banDetails.findMany).toHaveBeenCalledWith({
        where: { userId: '1' },
      });
      expect(result.length).toBe(1);
    });
  });

  describe('createBanDetails', () => {
    it('should create ban details', async () => {
      prismaMock.banDetails.create.mockResolvedValue({ id: 'ban-1', userId: '1' });

      const data = {
        userId: '1',
        bannedBy: 'admin',
        banReason: 'test',
        banUntil: null,
        isBanned: true,
      };

      const result = await repository.createBanDetails(data);

      expect(prismaMock.banDetails.create).toHaveBeenCalledWith({
        data,
      });
      expect(result.id).toBe('ban-1');
    });
  });
});

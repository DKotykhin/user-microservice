import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';

import { HashService } from '../hash.service';
import { AppError } from 'src/utils/errors/app-error';

jest.mock('bcryptjs', () => ({
  genSalt: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('HashService', () => {
  let service: HashService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HashService],
    }).compile();

    service = module.get<HashService>(HashService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create password hash', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.create('password');

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password', 'salt');
      expect(result).toBe('hashed-password');
    });

    it('should throw error if hash creation fails', async () => {
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue(null);

      await expect(service.create('password')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('compare', () => {
    it('should return true when passwords match', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.compare('password', 'hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hash');
      expect(result).toBe(true);
    });

    it('should return false when passwords do not match', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.compare('password', 'hash');

      expect(result).toBe(false);
    });
  });

  describe('same', () => {
    it('should throw error if passwords are the same', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.theSame('password', 'hash')).rejects.toBeInstanceOf(AppError);
    });

    it('should return false if passwords are different', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.theSame('password', 'hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hash');
      expect(result).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate token against hash', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validate('token', 'hash');

      expect(bcrypt.compare).toHaveBeenCalledWith('token', 'hash');
      expect(result).toBe(true);
    });
  });
});

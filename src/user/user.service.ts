import { Injectable, Logger } from '@nestjs/common';

import { HashService } from 'src/hash/hash.service';
import { AppError } from 'src/utils/errors/app-error';
import { convertEnum } from 'src/utils/convertEnum';
import { MessageBrokerService } from 'src/transport/message-broker/message-broker.service';
import { UserRepository } from './user.repository';

import type { UserRole as PrismaUserRole } from 'prisma/generated-types/enums';
import {
  UserRole,
  type AllUsersResponse,
  type BanDetailsResponse,
  type BanUserRequest,
  type GetBannedUsersResponse,
  type PaginationMeta,
  type PasswordRequest,
  type StatusResponse,
  type UpdateUserRequest,
  type User,
} from 'src/generated-types/user';
import type { EmailRequest } from 'src/transport/message-broker/email.request.interface';

@Injectable()
export class UserService {
  constructor(
    private readonly hashService: HashService,
    private readonly userRepository: UserRepository,
    private readonly messageBrokerService: MessageBrokerService,
  ) {}
  protected readonly logger = new Logger(UserService.name);

  private sendBanNotificationEmail(to: string, name?: string | null, reason?: string): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Account Banned',
      template: 'account-banned',
      context: {
        name: name || 'User',
        reason,
      },
    } as EmailRequest);
  }
  private sendUnBanNotificationEmail(to: string, name?: string | null): void {
    this.messageBrokerService.emitMessage('notification.email.send', {
      to,
      subject: 'Account Unbanned',
      template: 'account-unbanned',
      context: {
        name: name || 'User',
      },
    } as EmailRequest);
  }

  async getUserById(id: string): Promise<User> {
    this.logger.log(`Fetching user by ID: ${id}`);
    try {
      const user = await this.userRepository.findUserById(id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${id}`);
        throw AppError.notFound('User not found');
      }
      return {
        ...user,
        role: convertEnum(UserRole, user.role),
      };
    } catch (error) {
      this.logger.error(`Error fetching user: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to fetch user');
    }
  }

  async getAllUsers(data: PaginationMeta): Promise<AllUsersResponse> {
    this.logger.log('Fetching all users');
    try {
      const { users, meta } = await this.userRepository.getAllUsers(data);
      const convertedUsers = users.map((user) => ({
        ...user,
        role: convertEnum(UserRole, user.role),
      }));
      return { users: convertedUsers, meta };
    } catch (error) {
      this.logger.error(`Error fetching all users: ${error instanceof Error ? error.message : error}`);
      throw AppError.internalServerError('Failed to fetch all users');
    }
  }

  async updateUser(data: UpdateUserRequest): Promise<User> {
    this.logger.log(`Updating user with ID: ${data.id}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }

      const updatedUser = await this.userRepository.updateUser({ id: data.id, data });
      this.logger.log(`User updated with ID: ${data.id}`);
      return {
        ...updatedUser,
        role: convertEnum(UserRole, updatedUser.role),
      };
    } catch (error) {
      this.logger.error(`Error updating user: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<StatusResponse> {
    this.logger.log(`Deleting user with ID: ${id}`);
    try {
      const user = await this.userRepository.findUserById(id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${id}`);
        throw AppError.notFound('User not found');
      }

      await this.userRepository.deleteUser(id);
      this.logger.log(`User deleted with ID: ${id}`);
      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting user: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to delete user');
    }
  }

  async confirmPassword(data: PasswordRequest): Promise<StatusResponse> {
    this.logger.log(`Confirming password for user ID: ${data.id}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }

      const isMatch = await this.hashService.compare(data.password, user.passwordHash);
      if (!isMatch) {
        this.logger.warn(`Password mismatch for user ID: ${data.id}`);
        throw AppError.badRequest('Invalid password');
      }

      this.logger.log(`Password confirmed for user ID: ${data.id}`);
      return { success: true, message: 'Password confirmed successfully' };
    } catch (error) {
      this.logger.error(`Error confirming password: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to confirm password');
    }
  }

  async changePassword(data: PasswordRequest): Promise<StatusResponse> {
    this.logger.log(`Changing password for user ID: ${data.id}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }
      await this.hashService.same(data.password, user.passwordHash);

      const newPasswordHash = await this.hashService.create(data.password);
      await this.userRepository.updateUser({ id: data.id, data: { passwordHash: newPasswordHash } });

      this.logger.log(`Password changed for user ID: ${data.id}`);
      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error(`Error changing password: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to change password');
    }
  }

  async banUser(data: BanUserRequest): Promise<User> {
    this.logger.log(`Banning user with ID: ${data.id}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }
      if (user.isBanned) {
        this.logger.warn(`User already banned with ID: ${data.id}`);
        throw AppError.badRequest('User is already banned');
      }

      await this.userRepository.createBanDetails({
        userId: data.id,
        bannedBy: data.bannedBy,
        banReason: data.reason || null,
        banUntil: data.banUntil || null,
        isBanned: true,
      });

      const bannedUser = await this.userRepository.updateUser({
        id: data.id,
        data: { isBanned: true },
      });

      this.sendBanNotificationEmail(
        user.email,
        user.name,
        data.reason || 'Your account has been banned. Please contact support for more information.',
      );

      this.logger.log(`User banned with ID: ${data.id}`);
      return {
        ...bannedUser,
        role: convertEnum(UserRole, bannedUser.role),
      };
    } catch (error) {
      this.logger.error(`Error banning user: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to ban user');
    }
  }

  async unbanUser(data: BanUserRequest): Promise<User> {
    this.logger.log(`Unbanning user with ID: ${data.id}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }
      if (!user.isBanned) {
        this.logger.warn(`User is not banned with ID: ${data.id}`);
        throw AppError.badRequest('User is not banned');
      }

      await this.userRepository.createBanDetails({
        userId: data.id,
        bannedBy: data.bannedBy,
        banReason: data.reason || 'Unbanned',
        banUntil: null,
        isBanned: false,
      });

      const unbannedUser = await this.userRepository.updateUser({
        id: data.id,
        data: { isBanned: false },
      });

      this.sendUnBanNotificationEmail(user.email, user.name);

      this.logger.log(`User unbanned with ID: ${data.id}`);
      return {
        ...unbannedUser,
        role: convertEnum(UserRole, unbannedUser.role),
      };
    } catch (error) {
      this.logger.error(`Error unbanning user: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to unban user');
    }
  }

  async getBannedUsers(): Promise<GetBannedUsersResponse> {
    this.logger.log('Getting all banned users');
    const bannedUsers = await this.userRepository.getBannedUsers();

    const users = bannedUsers.map((user) => ({
      ...user,
      role: convertEnum(UserRole, user.role),
    }));
    return { users };
  }

  async getBanDetailsByUserId(userId: string): Promise<BanDetailsResponse> {
    this.logger.log(`Getting ban details for user ID: ${userId}`);
    const banDetails = await this.userRepository.getBanDetailsByUserId(userId);
    return { banDetails };
  }

  async changeUserRole(data: { id: string; role: UserRole }): Promise<User> {
    this.logger.log(`Changing role for user ID: ${data.id} to ${UserRole[data.role]}`);
    try {
      const user = await this.userRepository.findUserById(data.id);
      if (!user) {
        this.logger.warn(`User not found with ID: ${data.id}`);
        throw AppError.notFound('User not found');
      }

      const updatedUser = await this.userRepository.updateUser({
        id: data.id,
        data: { role: UserRole[data.role] as PrismaUserRole },
      });
      this.logger.log(`User role changed for ID: ${data.id} to ${UserRole[data.role]}`);
      return {
        ...updatedUser,
        role: convertEnum(UserRole, updatedUser.role),
      };
    } catch (error) {
      this.logger.error(`Error changing user role: ${error instanceof Error ? error.message : error}`);
      if (error instanceof AppError) throw error;
      throw AppError.internalServerError('Failed to change user role');
    }
  }
}

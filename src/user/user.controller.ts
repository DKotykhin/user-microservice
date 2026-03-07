import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { BusinessMetricsInterceptor, GrpcMetricsInterceptor } from 'src/supervision/metrics/interceptors';
import {
  type AllUsersResponse,
  type BanDetailsResponse,
  type BanUserRequest,
  type DeliveryAddress,
  type GetBannedUsersResponse,
  type GetDeliveryAddressesResponse,
  type PaginationMeta,
  type PasswordRequest,
  type StatusResponse,
  type UpdateUserRequest,
  type UpsertDeliveryAddressRequest,
  type User,
  USER_SERVICE_NAME,
  type UserRole,
} from 'src/generated-types/user';
import { UserService } from './user.service';

@Controller('user')
@UseInterceptors(GrpcMetricsInterceptor, BusinessMetricsInterceptor)
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(private readonly userService: UserService) {}

  @GrpcMethod(USER_SERVICE_NAME, 'GetUserById')
  async getUserById({ id }: { id: string }): Promise<User> {
    this.logger.log(`Received GetUserById request for id: ${id}`);
    return this.userService.getUserById(id);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetAllUsers')
  async getAllUsers(data: PaginationMeta): Promise<AllUsersResponse> {
    this.logger.log('Received GetAllUsers request');
    return this.userService.getAllUsers(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UpdateUser')
  async updateUser(data: UpdateUserRequest): Promise<User> {
    this.logger.log(`Received UpdateUser request for id: ${data.id}`);
    return this.userService.updateUser(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'DeleteUser')
  async deleteUser({ id }: { id: string }): Promise<StatusResponse> {
    this.logger.log(`Received DeleteUser request for id: ${id}`);
    return this.userService.deleteUser(id);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'ConfirmPassword')
  async confirmPassword(data: PasswordRequest): Promise<StatusResponse> {
    this.logger.log(`Received ConfirmPassword request for user id: ${data.id}`);
    return this.userService.confirmPassword(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'ChangePassword')
  async changePassword(data: PasswordRequest): Promise<StatusResponse> {
    this.logger.log(`Received ChangePassword request for user id: ${data.id}`);
    return this.userService.changePassword(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'BanUser')
  async banUser(data: BanUserRequest): Promise<User> {
    this.logger.log(`Received BanUser request for id: ${data.id}`);
    return this.userService.banUser(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UnbanUser')
  async unbanUser(data: BanUserRequest): Promise<User> {
    this.logger.log(`Received UnbanUser request for id: ${data.id}`);
    return this.userService.unbanUser(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetBannedUsers')
  async getBannedUsers(): Promise<GetBannedUsersResponse> {
    this.logger.log('Received GetBannedUsers request');
    return this.userService.getBannedUsers();
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetBanDetailsByUserId')
  async getBanDetailsByUserId({ id }: { id: string }): Promise<BanDetailsResponse> {
    this.logger.log(`Received GetBanDetailsByUserId request for id: ${id}`);
    return this.userService.getBanDetailsByUserId(id);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'ChangeUserRole')
  async changeUserRole(data: { id: string; role: UserRole }): Promise<User> {
    this.logger.log(`Received ChangeUserRole request for id: ${data.id}`);
    return this.userService.changeUserRole({ id: data.id, role: data.role });
  }

  @GrpcMethod(USER_SERVICE_NAME, 'GetDeliveryAddresses')
  async getDeliveryAddresses({ id }: { id: string }): Promise<GetDeliveryAddressesResponse> {
    this.logger.log(`Received GetDeliveryAddresses request for user id: ${id}`);
    return this.userService.getDeliveryAddressesByUserId(id);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'UpsertDeliveryAddress')
  async upsertDeliveryAddress(data: UpsertDeliveryAddressRequest): Promise<DeliveryAddress> {
    this.logger.log(`Received UpsertDeliveryAddress request for user id: ${data.userId}`);
    return this.userService.upsertDeliveryAddress(data);
  }

  @GrpcMethod(USER_SERVICE_NAME, 'DeleteDeliveryAddress')
  async deleteDeliveryAddress({ id }: { id: string }): Promise<StatusResponse> {
    this.logger.log(`Received DeleteDeliveryAddress request for id: ${id}`);
    return this.userService.deleteDeliveryAddress(id);
  }
}

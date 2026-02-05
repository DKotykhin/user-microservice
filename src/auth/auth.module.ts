import { Module } from '@nestjs/common';

import { HashService } from 'src/hash/hash.service';
import { UserRepository } from 'src/user/user.repository';
import { RedisService } from 'src/redis/redis.service';
import { TokenService } from 'src/token/token.service';
import { RateLimiterService } from 'src/rate-limiter/rate-limiter.service';
import { DeviceService } from 'src/device/device.service';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    DeviceService,
    HashService,
    RateLimiterService,
    RedisService,
    TokenService,
    UserRepository,
  ],
})
export class AuthModule {}

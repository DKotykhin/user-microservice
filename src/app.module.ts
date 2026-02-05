import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { validateEnv } from './utils/validators/env-validator';
import { EnvironmentVariables } from './utils/env.dto';
import { PrismaModule } from './prisma/prisma.module';
import { HealthCheckModule } from './health-check/health-check.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { HashModule } from './hash/hash.module';
import { RedisModule } from './redis/redis.module';
import { TokenModule } from './token/token.module';
import { MessageBrokerModule } from './transport/message-broker/message-broker.module';
import { MetricsModule } from './supervision/metrics/metrics.module';
import { RateLimiterModule } from './rate-limiter/rate-limiter.module';
import { DeviceModule } from './device/device.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local'],
      validate: (config) => validateEnv(config, EnvironmentVariables),
    }),
    JwtModule.register({
      global: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    PrismaModule,
    HealthCheckModule,
    UserModule,
    AuthModule,
    HashModule,
    RedisModule,
    TokenModule,
    MessageBrokerModule,
    MetricsModule,
    RateLimiterModule,
    DeviceModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

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
    PrismaModule,
    HealthCheckModule,
    UserModule,
    AuthModule,
    HashModule,
    RedisModule,
    TokenModule,
    MessageBrokerModule,
    MetricsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

import { AppModule } from './app.module';
import { GrpcExceptionFilter } from './utils/filters/grpc-exception.filter';
import { HEALTH_CHECK_V1_PACKAGE_NAME } from './generated-types/health-check';
import { AUTH_V1_PACKAGE_NAME } from './generated-types/auth';
import { USER_V1_PACKAGE_NAME } from './generated-types/user';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const logger = new Logger('Main');
  const configService = app.get(ConfigService);
  const url = configService.getOrThrow<string>('TRANSPORT_URL');

  app.useGlobalFilters(new GrpcExceptionFilter());

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: [HEALTH_CHECK_V1_PACKAGE_NAME, AUTH_V1_PACKAGE_NAME, USER_V1_PACKAGE_NAME],
      protoPath: ['proto/health-check.proto', 'proto/auth.proto', 'proto/user.proto'],
      url,
    },
  });

  await app.startAllMicroservices();
  await app.listen(9101);
  logger.log('User microservice is running on ' + url);
}
void bootstrap();

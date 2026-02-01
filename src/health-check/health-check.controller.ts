import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { GrpcMetricsInterceptor } from 'src/supervision/metrics/grpc-metrics.interceptor';
import { HEALTH_CHECK_SERVICE_NAME, type HealthCheckResponse } from 'src/generated-types/health-check';
import { HealthCheckService } from './health-check.service';

@Controller()
@UseInterceptors(GrpcMetricsInterceptor)
export class HealthCheckController {
  protected readonly logger = new Logger(HealthCheckController.name);
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @GrpcMethod(HEALTH_CHECK_SERVICE_NAME, 'CheckAppHealth')
  checkHealth(): HealthCheckResponse {
    this.logger.log('Health check requested');
    return {
      serving: true,
      message: 'User microservice is healthy',
    };
  }

  @GrpcMethod(HEALTH_CHECK_SERVICE_NAME, 'CheckDatabaseConnection')
  async checkDatabaseConnection(): Promise<HealthCheckResponse> {
    this.logger.log('Database connection health check requested');
    const response = await this.healthCheckService.checkDatabaseConnection();
    return {
      serving: response,
      message: response ? 'Database connection is healthy' : 'Database connection failed',
    };
  }
}

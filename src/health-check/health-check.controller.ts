import { Controller, Logger, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';

import { GrpcMetricsInterceptor } from 'src/supervision/metrics/interceptors';
import {
  HEALTH_CHECK_SERVICE_NAME,
  type HealthCheckResponse,
  type ReadinessResponse,
} from 'src/generated-types/health-check';
import { HealthCheckService } from './health-check.service';

@Controller()
@UseInterceptors(GrpcMetricsInterceptor)
export class HealthCheckController {
  private readonly logger = new Logger(HealthCheckController.name);
  constructor(private readonly healthCheckService: HealthCheckService) {}

  @GrpcMethod(HEALTH_CHECK_SERVICE_NAME, 'CheckAppHealth')
  checkHealth(): HealthCheckResponse {
    this.logger.log('Health check requested');
    return {
      serving: true,
      message: 'User microservice is healthy',
    };
  }

  @GrpcMethod(HEALTH_CHECK_SERVICE_NAME, 'CheckAppConnections')
  async checkAppConnections(): Promise<ReadinessResponse> {
    this.logger.log('Check app connections requested');
    return this.healthCheckService.checkAppConnections();
  }
}

import { Global, Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

import { allMetricProviders } from './providers';
import { BusinessMetricsInterceptor, GrpcMetricsInterceptor } from './interceptors';
import { BusinessMetricsService } from './services';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [...allMetricProviders, GrpcMetricsInterceptor, BusinessMetricsInterceptor, BusinessMetricsService],
  exports: [...allMetricProviders, GrpcMetricsInterceptor, BusinessMetricsInterceptor, BusinessMetricsService],
})
export class MetricsModule {}

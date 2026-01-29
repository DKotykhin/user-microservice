import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { makeCounterProvider, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';
import { GrpcMetricsInterceptor } from './grpc-metrics.interceptor';

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
  providers: [
    makeHistogramProvider({
      name: 'user_request_duration_seconds',
      help: 'Duration of user requests in seconds',
      labelNames: ['service', 'method', 'endpoint', 'status'],
      buckets: [0.1, 0.5, 1, 2.5, 5, 10],
    }),
    makeCounterProvider({
      name: 'user_requests_total',
      help: 'Total number of user requests',
      labelNames: ['service', 'method', 'endpoint', 'status'],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: GrpcMetricsInterceptor,
    },
    GrpcMetricsInterceptor,
  ],
  exports: [],
})
export class MetricsModule {}

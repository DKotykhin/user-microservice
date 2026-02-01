import { Global, Module } from '@nestjs/common';
import { makeCounterProvider, makeHistogramProvider, PrometheusModule } from '@willsoto/nestjs-prometheus';
import { GrpcMetricsInterceptor } from './grpc-metrics.interceptor';

// gRPC server started total - counts requests that have been started
const grpcServerStartedTotal = makeCounterProvider({
  name: 'grpc_server_started_total',
  help: 'Total number of RPCs started on the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

// gRPC server handled total - counts requests that have been completed
const grpcServerHandledTotal = makeCounterProvider({
  name: 'grpc_server_handled_total',
  help: 'Total number of RPCs completed on the server, regardless of success or failure',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type', 'grpc_code'],
});

// gRPC server handling seconds - histogram of request duration
const grpcServerHandlingSeconds = makeHistogramProvider({
  name: 'grpc_server_handling_seconds',
  help: 'Histogram of response latency of RPCs handled by the server in seconds',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// gRPC server messages received total
const grpcServerMsgReceivedTotal = makeCounterProvider({
  name: 'grpc_server_msg_received_total',
  help: 'Total number of RPC stream messages received on the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

// gRPC server messages sent total
const grpcServerMsgSentTotal = makeCounterProvider({
  name: 'grpc_server_msg_sent_total',
  help: 'Total number of RPC stream messages sent by the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

const grpcMetricProviders = [
  grpcServerStartedTotal,
  grpcServerHandledTotal,
  grpcServerHandlingSeconds,
  grpcServerMsgReceivedTotal,
  grpcServerMsgSentTotal,
];

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
  providers: [...grpcMetricProviders, GrpcMetricsInterceptor],
  exports: [...grpcMetricProviders, GrpcMetricsInterceptor],
})
export class MetricsModule {}

import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const GRPC_SERVER_STARTED_TOTAL = 'grpc_server_started_total' as const;
export const GRPC_SERVER_HANDLED_TOTAL = 'grpc_server_handled_total' as const;
export const GRPC_SERVER_HANDLING_SECONDS = 'grpc_server_handling_seconds' as const;
export const GRPC_SERVER_MSG_RECEIVED_TOTAL = 'grpc_server_msg_received_total' as const;
export const GRPC_SERVER_MSG_SENT_TOTAL = 'grpc_server_msg_sent_total' as const;

export const grpcServerStartedTotal = makeCounterProvider({
  name: GRPC_SERVER_STARTED_TOTAL,
  help: 'Total number of RPCs started on the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

export const grpcServerHandledTotal = makeCounterProvider({
  name: GRPC_SERVER_HANDLED_TOTAL,
  help: 'Total number of RPCs completed on the server, regardless of success or failure',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type', 'grpc_code'],
});

export const grpcServerHandlingSeconds = makeHistogramProvider({
  name: GRPC_SERVER_HANDLING_SECONDS,
  help: 'Histogram of response latency of RPCs handled by the server in seconds',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const grpcServerMsgReceivedTotal = makeCounterProvider({
  name: GRPC_SERVER_MSG_RECEIVED_TOTAL,
  help: 'Total number of RPC stream messages received on the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

export const grpcServerMsgSentTotal = makeCounterProvider({
  name: GRPC_SERVER_MSG_SENT_TOTAL,
  help: 'Total number of RPC stream messages sent by the server',
  labelNames: ['grpc_service', 'grpc_method', 'grpc_type'],
});

export const grpcMetricProviders = [
  grpcServerStartedTotal,
  grpcServerHandledTotal,
  grpcServerHandlingSeconds,
  grpcServerMsgReceivedTotal,
  grpcServerMsgSentTotal,
];

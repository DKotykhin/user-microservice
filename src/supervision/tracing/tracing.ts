import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { Logger } from '@nestjs/common';

const jaegerExporter = new OTLPTraceExporter({
  url: 'http://jaeger:4317', // gRPC endpoint (4317 for gRPC, 4318 for HTTP)
});

const logger = new Logger('TracingService');

export const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'user-microservice',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },
      '@opentelemetry/instrumentation-grpc': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },
      '@opentelemetry/instrumentation-redis': { enabled: true },
    }),
  ],
});

// Initialize the SDK and start tracing
export const initTracing = (): void => {
  sdk.start();
  logger.log('Tracing initialized', 'TracingService');
};

// Shutdown the SDK and flush traces
export const shutdownTracing = async (): Promise<void> => {
  await sdk.shutdown();
  logger.log('Tracing terminated', 'TracingService');
};

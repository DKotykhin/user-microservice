import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

type GrpcType = 'unary' | 'client_stream' | 'server_stream' | 'bidi_stream';

@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  public constructor(
    @InjectMetric('grpc_server_started_total')
    private readonly grpcServerStartedTotal: Counter<string>,
    @InjectMetric('grpc_server_handled_total')
    private readonly grpcServerHandledTotal: Counter<string>,
    @InjectMetric('grpc_server_handling_seconds')
    private readonly grpcServerHandlingSeconds: Histogram<string>,
    @InjectMetric('grpc_server_msg_received_total')
    private readonly grpcServerMsgReceivedTotal: Counter<string>,
    @InjectMetric('grpc_server_msg_sent_total')
    private readonly grpcServerMsgSentTotal: Counter<string>,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    // Skip metrics endpoint to avoid inflating counts from Prometheus scrapes
    if (context.getType() === 'http') {
      const request = context.switchToHttp().getRequest<{ url: string }>();
      if (request.url === '/metrics') {
        return next.handle();
      }
    }

    const grpcService = context.getClass().name;
    const grpcMethod = context.getHandler().name;
    const grpcType: GrpcType = 'unary'; // Default to unary, can be extended for streaming

    const labels = {
      grpc_service: grpcService,
      grpc_method: grpcMethod,
      grpc_type: grpcType,
    };

    // Increment started counter
    this.grpcServerStartedTotal.inc(labels);

    // Increment message received (for unary, 1 message is received per call)
    this.grpcServerMsgReceivedTotal.inc(labels);

    // Start timing
    const end = this.grpcServerHandlingSeconds.startTimer(labels);

    return next.handle().pipe(
      tap({
        next: () => {
          // Increment message sent (for unary, 1 message is sent per call)
          this.grpcServerMsgSentTotal.inc(labels);

          // Increment handled counter with OK status
          this.grpcServerHandledTotal.inc({
            ...labels,
            grpc_code: GrpcStatus[GrpcStatus.OK],
          });

          end();
        },
        error: (error: unknown) => {
          const grpcCode = this.extractGrpcStatusCode(error);

          // Increment handled counter with error status
          this.grpcServerHandledTotal.inc({
            ...labels,
            grpc_code: GrpcStatus[grpcCode],
          });

          end();
        },
      }),
    );
  }

  private extractGrpcStatusCode(error: unknown): GrpcStatus {
    if (error instanceof RpcException) {
      const rpcError = error.getError();
      if (typeof rpcError === 'object' && rpcError !== null && 'code' in rpcError) {
        return (rpcError as { code: GrpcStatus }).code;
      }
    }

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = (error as { code: unknown }).code;
      if (typeof code === 'number' && code in GrpcStatus) {
        return code;
      }
    }

    return GrpcStatus.UNKNOWN;
  }
}

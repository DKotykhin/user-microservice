import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import {
  GRPC_SERVER_HANDLED_TOTAL,
  GRPC_SERVER_HANDLING_SECONDS,
  GRPC_SERVER_MSG_RECEIVED_TOTAL,
  GRPC_SERVER_MSG_SENT_TOTAL,
  GRPC_SERVER_STARTED_TOTAL,
} from '../providers';

type GrpcType = 'unary' | 'client_stream' | 'server_stream' | 'bidi_stream';

@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  public constructor(
    @InjectMetric(GRPC_SERVER_STARTED_TOTAL)
    private readonly grpcServerStartedTotal: Counter<string>,
    @InjectMetric(GRPC_SERVER_HANDLED_TOTAL)
    private readonly grpcServerHandledTotal: Counter<string>,
    @InjectMetric(GRPC_SERVER_HANDLING_SECONDS)
    private readonly grpcServerHandlingSeconds: Histogram<string>,
    @InjectMetric(GRPC_SERVER_MSG_RECEIVED_TOTAL)
    private readonly grpcServerMsgReceivedTotal: Counter<string>,
    @InjectMetric(GRPC_SERVER_MSG_SENT_TOTAL)
    private readonly grpcServerMsgSentTotal: Counter<string>,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const grpcService = context.getClass().name;
    const grpcMethod = context.getHandler().name;
    const grpcType: GrpcType = 'unary';

    const labels = {
      grpc_service: grpcService,
      grpc_method: grpcMethod,
      grpc_type: grpcType,
    };

    this.grpcServerStartedTotal.inc(labels);
    this.grpcServerMsgReceivedTotal.inc(labels);

    const end = this.grpcServerHandlingSeconds.startTimer(labels);

    return next.handle().pipe(
      tap({
        next: () => {
          this.grpcServerMsgSentTotal.inc(labels);
          this.grpcServerHandledTotal.inc({
            ...labels,
            grpc_code: GrpcStatus[GrpcStatus.OK],
          });
          end();
        },
        error: (error: unknown) => {
          const grpcCode = this.extractGrpcStatusCode(error);
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

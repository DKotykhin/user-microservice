import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';

@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  public constructor(
    @InjectMetric('user_request_duration_seconds') private readonly userRequestDurationSeconds: Histogram<string>,
    @InjectMetric('user_requests_total') private readonly userRequestsTotal: Counter<string>,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> {
    const service = 'user-microservice';
    const method = context.getHandler().name;

    const end = this.userRequestDurationSeconds.startTimer({
      service,
      method,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          this.userRequestsTotal.inc({
            service,
            method,
            status: 'success',
          });
          end({ status: 'success' });
        },
        error: () => {
          this.userRequestsTotal.inc({
            service,
            method,
            status: 'error',
          });
          end({ status: 'error' });
        },
      }),
    );
  }
}

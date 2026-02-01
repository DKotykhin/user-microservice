import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { BusinessMetricsService } from '../services';

type BusinessMetricType =
  | 'registration'
  | 'emailVerification'
  | 'login'
  | 'tokenRefresh'
  | 'passwordReset'
  | 'passwordChange'
  | 'ban'
  | 'unban'
  | 'deletion'
  | 'roleChange';

const METHOD_TO_METRIC: Record<string, BusinessMetricType> = {
  // Auth operations
  signUp: 'registration',
  verifyEmail: 'emailVerification',
  signIn: 'login',
  refreshToken: 'tokenRefresh',
  initResetPassword: 'passwordReset',
  setNewPassword: 'passwordReset',

  // User operations
  changePassword: 'passwordChange',
  banUser: 'ban',
  unbanUser: 'unban',
  deleteUser: 'deletion',
  changeUserRole: 'roleChange',
};

@Injectable()
export class BusinessMetricsInterceptor implements NestInterceptor {
  public constructor(private readonly businessMetrics: BusinessMetricsService) {}

  public intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const methodName = context.getHandler().name;
    const metricType = METHOD_TO_METRIC[methodName];

    if (!metricType) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => this.recordMetric(metricType, 'success'),
        error: () => this.recordMetric(metricType, 'failure'),
      }),
    );
  }

  private recordMetric(type: BusinessMetricType, status: 'success' | 'failure'): void {
    switch (type) {
      case 'registration':
        this.businessMetrics.recordRegistration(status);
        if (status === 'success') {
          this.businessMetrics.incrementTotalUsers('active');
        }
        break;
      case 'emailVerification':
        this.businessMetrics.recordEmailVerification(status);
        break;
      case 'login':
        this.businessMetrics.recordLoginAttempt(status);
        break;
      case 'tokenRefresh':
        this.businessMetrics.recordTokenRefresh(status);
        break;
      case 'passwordReset':
        this.businessMetrics.recordPasswordReset(status);
        break;
      case 'passwordChange':
        this.businessMetrics.recordPasswordChange(status);
        break;
      case 'ban':
        this.businessMetrics.recordUserBan(status);
        break;
      case 'unban':
        this.businessMetrics.recordUserUnban(status);
        break;
      case 'deletion':
        this.businessMetrics.recordUserDeletion(status);
        if (status === 'success') {
          this.businessMetrics.decrementTotalUsers('active');
        }
        break;
      case 'roleChange':
        this.businessMetrics.recordRoleChange(status);
        break;
    }
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';
import {
  USER_REGISTRATIONS_TOTAL,
  USER_EMAIL_VERIFICATIONS_TOTAL,
  USER_LOGIN_ATTEMPTS_TOTAL,
  USER_TOKEN_REFRESHES_TOTAL,
  USER_PASSWORD_RESETS_TOTAL,
  USER_PASSWORD_CHANGES_TOTAL,
  USER_BANS_TOTAL,
  USER_UNBANS_TOTAL,
  USER_DELETIONS_TOTAL,
  USER_ROLE_CHANGES_TOTAL,
  USERS_TOTAL,
} from '../providers';

type MetricStatus = 'success' | 'failure';

@Injectable()
export class BusinessMetricsService implements OnModuleInit {
  public constructor(
    @InjectMetric(USER_REGISTRATIONS_TOTAL)
    private readonly userRegistrationsTotal: Counter<string>,
    @InjectMetric(USER_EMAIL_VERIFICATIONS_TOTAL)
    private readonly userEmailVerificationsTotal: Counter<string>,
    @InjectMetric(USER_LOGIN_ATTEMPTS_TOTAL)
    private readonly userLoginAttemptsTotal: Counter<string>,
    @InjectMetric(USER_TOKEN_REFRESHES_TOTAL)
    private readonly userTokenRefreshesTotal: Counter<string>,
    @InjectMetric(USER_PASSWORD_RESETS_TOTAL)
    private readonly userPasswordResetsTotal: Counter<string>,
    @InjectMetric(USER_PASSWORD_CHANGES_TOTAL)
    private readonly userPasswordChangesTotal: Counter<string>,
    @InjectMetric(USER_BANS_TOTAL)
    private readonly userBansTotal: Counter<string>,
    @InjectMetric(USER_UNBANS_TOTAL)
    private readonly userUnbansTotal: Counter<string>,
    @InjectMetric(USER_DELETIONS_TOTAL)
    private readonly userDeletionsTotal: Counter<string>,
    @InjectMetric(USER_ROLE_CHANGES_TOTAL)
    private readonly userRoleChangesTotal: Counter<string>,
    @InjectMetric(USERS_TOTAL)
    private readonly usersTotal: Gauge<string>,
  ) {}

  public onModuleInit(): void {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Initialize all counters with 0 for both success and failure labels
    // This makes them visible in Prometheus immediately
    const counters = [
      this.userRegistrationsTotal,
      this.userEmailVerificationsTotal,
      this.userLoginAttemptsTotal,
      this.userTokenRefreshesTotal,
      this.userPasswordResetsTotal,
      this.userPasswordChangesTotal,
      this.userBansTotal,
      this.userUnbansTotal,
      this.userDeletionsTotal,
    ];

    for (const counter of counters) {
      counter.inc({ status: 'success' }, 0);
      counter.inc({ status: 'failure' }, 0);
    }

    // Initialize role changes with common roles
    this.userRoleChangesTotal.inc({ status: 'success', new_role: 'unknown' }, 0);
    this.userRoleChangesTotal.inc({ status: 'failure', new_role: 'unknown' }, 0);

    // Initialize gauge
    this.usersTotal.set({ status: 'active' }, 0);
    this.usersTotal.set({ status: 'banned' }, 0);
  }

  // Registration metrics
  public recordRegistration(status: MetricStatus): void {
    this.userRegistrationsTotal.inc({ status });
  }

  public recordEmailVerification(status: MetricStatus): void {
    this.userEmailVerificationsTotal.inc({ status });
  }

  // Authentication metrics
  public recordLoginAttempt(status: MetricStatus): void {
    this.userLoginAttemptsTotal.inc({ status });
  }

  public recordTokenRefresh(status: MetricStatus): void {
    this.userTokenRefreshesTotal.inc({ status });
  }

  // Password metrics
  public recordPasswordReset(status: MetricStatus): void {
    this.userPasswordResetsTotal.inc({ status });
  }

  public recordPasswordChange(status: MetricStatus): void {
    this.userPasswordChangesTotal.inc({ status });
  }

  // User management metrics
  public recordUserBan(status: MetricStatus): void {
    this.userBansTotal.inc({ status });
  }

  public recordUserUnban(status: MetricStatus): void {
    this.userUnbansTotal.inc({ status });
  }

  public recordUserDeletion(status: MetricStatus): void {
    this.userDeletionsTotal.inc({ status });
  }

  public recordRoleChange(status: MetricStatus, newRole?: string): void {
    this.userRoleChangesTotal.inc({ status, new_role: newRole ?? 'unknown' });
  }

  // Gauge metrics
  public setTotalUsers(count: number, status: 'active' | 'banned' = 'active'): void {
    this.usersTotal.set({ status }, count);
  }

  public incrementTotalUsers(status: 'active' | 'banned' = 'active'): void {
    this.usersTotal.inc({ status });
  }

  public decrementTotalUsers(status: 'active' | 'banned' = 'active'): void {
    this.usersTotal.dec({ status });
  }
}

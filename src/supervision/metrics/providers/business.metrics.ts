import { makeCounterProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

// Registration metrics
export const USER_REGISTRATIONS_TOTAL = 'user_registrations_total' as const;
export const USER_EMAIL_VERIFICATIONS_TOTAL = 'user_email_verifications_total' as const;

// Authentication metrics
export const USER_LOGIN_ATTEMPTS_TOTAL = 'user_login_attempts_total' as const;
export const USER_TOKEN_REFRESHES_TOTAL = 'user_token_refreshes_total' as const;

// Password metrics
export const USER_PASSWORD_RESETS_TOTAL = 'user_password_resets_total' as const;
export const USER_PASSWORD_CHANGES_TOTAL = 'user_password_changes_total' as const;

// User management metrics
export const USER_BANS_TOTAL = 'user_bans_total' as const;
export const USER_UNBANS_TOTAL = 'user_unbans_total' as const;
export const USER_DELETIONS_TOTAL = 'user_deletions_total' as const;
export const USER_ROLE_CHANGES_TOTAL = 'user_role_changes_total' as const;

// Gauge metrics
export const USERS_TOTAL = 'users_total' as const;

// --- Providers ---

export const userRegistrationsTotal = makeCounterProvider({
  name: USER_REGISTRATIONS_TOTAL,
  help: 'Total number of user registration attempts',
  labelNames: ['status'],
});

export const userEmailVerificationsTotal = makeCounterProvider({
  name: USER_EMAIL_VERIFICATIONS_TOTAL,
  help: 'Total number of email verification attempts',
  labelNames: ['status'],
});

export const userLoginAttemptsTotal = makeCounterProvider({
  name: USER_LOGIN_ATTEMPTS_TOTAL,
  help: 'Total number of user login attempts',
  labelNames: ['status'],
});

export const userTokenRefreshesTotal = makeCounterProvider({
  name: USER_TOKEN_REFRESHES_TOTAL,
  help: 'Total number of token refresh attempts',
  labelNames: ['status'],
});

export const userPasswordResetsTotal = makeCounterProvider({
  name: USER_PASSWORD_RESETS_TOTAL,
  help: 'Total number of password reset requests',
  labelNames: ['status'],
});

export const userPasswordChangesTotal = makeCounterProvider({
  name: USER_PASSWORD_CHANGES_TOTAL,
  help: 'Total number of password change attempts',
  labelNames: ['status'],
});

export const userBansTotal = makeCounterProvider({
  name: USER_BANS_TOTAL,
  help: 'Total number of user bans',
  labelNames: ['status'],
});

export const userUnbansTotal = makeCounterProvider({
  name: USER_UNBANS_TOTAL,
  help: 'Total number of user unbans',
  labelNames: ['status'],
});

export const userDeletionsTotal = makeCounterProvider({
  name: USER_DELETIONS_TOTAL,
  help: 'Total number of user deletions',
  labelNames: ['status'],
});

export const userRoleChangesTotal = makeCounterProvider({
  name: USER_ROLE_CHANGES_TOTAL,
  help: 'Total number of user role changes',
  labelNames: ['status', 'new_role'],
});

export const usersTotal = makeGaugeProvider({
  name: USERS_TOTAL,
  help: 'Current total number of registered users',
  labelNames: ['status'],
});

export const businessMetricProviders = [
  userRegistrationsTotal,
  userEmailVerificationsTotal,
  userLoginAttemptsTotal,
  userTokenRefreshesTotal,
  userPasswordResetsTotal,
  userPasswordChangesTotal,
  userBansTotal,
  userUnbansTotal,
  userDeletionsTotal,
  userRoleChangesTotal,
  usersTotal,
];

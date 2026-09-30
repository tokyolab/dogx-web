import { requestClient } from '#/api/request';

export interface LoginSecurityConfig {
  rateLimitEnabled: boolean;
  rateLimitWindowSeconds: number;
  rateLimitMaxRequests: number;
  failureLockEnabled: boolean;
  failureWindowSeconds: number;
  failureThreshold: number;
  lockDurationSeconds: number;
}

export function getLoginSecurityApi() {
  return requestClient.post<LoginSecurityConfig>('/security/login/get');
}

export function updateLoginSecurityApi(data: LoginSecurityConfig) {
  return requestClient.post('/security/login/update', data);
}

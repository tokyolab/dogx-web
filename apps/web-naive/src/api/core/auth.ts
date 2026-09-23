import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    password: string;
    username: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi(refreshToken: string) {
  return baseRequestClient.post<AuthApi.LoginResult>('/auth/refresh', {
    refreshToken,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return requestClient.post('/auth/logout');
}

export function changePasswordApi(
  currentPassword: string,
  newPassword: string,
) {
  return requestClient.post('/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

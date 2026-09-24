import type { InternalAxiosRequestConfig } from '@vben/request';

import { AxiosError, isCancel } from '@vben/request';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { baseRequestClient, requestClient } from './request';

const mocks = vi.hoisted(() => ({
  shared: { accessToken: 'A0', refreshToken: 'S.R0' } as {
    accessToken: null | string;
    refreshToken: null | string;
  },
  store: {
    accessToken: 'A0' as null | string,
    refreshToken: 'S.R0' as null | string,
    isAccessChecked: true,
    syncCredentials: vi.fn(),
    setCredentials: vi.fn(),
    clearCredentials: vi.fn(),
    setLoginExpired: vi.fn(),
  },
  message: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/preferences', () => ({
  preferences: {
    app: {
      enableRefreshToken: true,
      locale: 'zh-CN',
      loginExpiredMode: 'page',
    },
  },
}));
vi.mock('@vben/stores', () => ({ useAccessStore: () => mocks.store }));
vi.mock('#/adapter/naive', () => ({ message: { error: mocks.message } }));
vi.mock('#/store', () => ({ useAuthStore: () => ({ logout: mocks.logout }) }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function httpFailure(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError(
    'Request failed',
    'ERR_BAD_RESPONSE',
    config,
    undefined,
    {
      config,
      status,
      statusText: 'Error',
      headers: {},
      data: { message: status === 401 ? '请先登录' : '服务异常' },
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shared = { accessToken: 'A0', refreshToken: 'S.R0' };
  Object.assign(mocks.store, mocks.shared);
  mocks.store.syncCredentials.mockImplementation(() => {
    Object.assign(mocks.store, mocks.shared);
  });
  mocks.store.setCredentials.mockImplementation((credentials) => {
    mocks.shared = credentials;
    Object.assign(mocks.store, credentials);
  });
  mocks.store.clearCredentials.mockImplementation(() => {
    mocks.shared = { accessToken: null, refreshToken: null };
    Object.assign(mocks.store, mocks.shared);
  });
  requestClient.isRefreshing = false;
  requestClient.refreshTokenQueue = [];
  requestClient.instance.defaults.adapter = vi.fn(async (config) => {
    throw httpFailure(config, 401);
  });
});

describe('authentication request notifications', () => {
  it.each([
    { event: 'logout', status: 200 },
    { event: 'login again', status: 200 },
    { event: 'logout', status: 401 },
    { event: 'login again', status: 401 },
  ])(
    'silently cancels a late refresh after $event (HTTP $status)',
    async ({ event, status }) => {
      const finish = deferred<undefined>();
      const started = deferred<undefined>();
      baseRequestClient.instance.defaults.adapter = vi.fn(async (config) => {
        started.resolve(undefined);
        await finish.promise;
        if (status !== 200) throw httpFailure(config, status);
        return {
          config,
          status,
          statusText: 'OK',
          headers: {},
          data: {
            code: 0,
            data: { accessToken: 'A1', refreshToken: 'S.R1', expiresIn: 900 },
          },
        };
      });
      const first = requestClient
        .get('/auth/profile')
        .catch((error: unknown) => error);
      await started.promise;
      const second = requestClient
        .get('/auth/me')
        .catch((error: unknown) => error);
      await vi.waitFor(() =>
        expect(requestClient.refreshTokenQueue).toHaveLength(1),
      );
      mocks.shared =
        event === 'logout'
          ? { accessToken: null, refreshToken: null }
          : { accessToken: 'NewLogin', refreshToken: 'T.R0' };
      finish.resolve(undefined);
      const errors = await Promise.all([first, second]);
      expect(mocks.message).not.toHaveBeenCalled();
      expect(errors.every(isCancel)).toBe(true);
      expect(mocks.store.setCredentials).not.toHaveBeenCalled();
      expect(mocks.store.clearCredentials).not.toHaveBeenCalled();
      expect(mocks.logout).not.toHaveBeenCalled();
      expect(mocks.store.refreshToken).toBe(mocks.shared.refreshToken);
      expect(requestClient.instance.defaults.adapter).toHaveBeenCalledTimes(2);
      expect(requestClient.refreshTokenQueue).toHaveLength(0);
      expect(requestClient.isRefreshing).toBe(false);
    },
  );

  it('silently cancels a request if another window logged out before sending', async () => {
    mocks.shared = { accessToken: null, refreshToken: null };
    const error = await requestClient
      .get('/auth/profile')
      .catch((error: unknown) => error);
    expect(mocks.message).not.toHaveBeenCalled();
    expect(isCancel(error)).toBe(true);
    expect(requestClient.instance.defaults.adapter).not.toHaveBeenCalled();
  });

  it.each([401, 500])(
    'still reports a real refresh HTTP %s failure',
    async (status) => {
      baseRequestClient.instance.defaults.adapter = async (config) => {
        throw httpFailure(config, status);
      };
      await expect(requestClient.get('/auth/profile')).rejects.toBeDefined();
      expect(mocks.message).toHaveBeenCalledWith(
        status === 401 ? '请先登录' : '服务异常',
      );
      expect(mocks.store.clearCredentials).toHaveBeenCalledTimes(
        status === 401 ? 1 : 0,
      );
      expect(mocks.logout).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );

  it.each([
    { message: 'Network Error', key: 'networkError' },
    { message: 'timeout of 1000ms exceeded', key: 'requestTimeout' },
  ])(
    'still reports a refresh $key without logging out',
    async ({ message, key }) => {
      baseRequestClient.instance.defaults.adapter = async () => {
        throw new AxiosError(message);
      };
      await expect(requestClient.get('/auth/profile')).rejects.toThrow(message);
      expect(mocks.message).toHaveBeenCalledWith(`ui.fallback.http.${key}`);
      expect(mocks.store.clearCredentials).not.toHaveBeenCalled();
      expect(mocks.logout).not.toHaveBeenCalled();
    },
  );
});

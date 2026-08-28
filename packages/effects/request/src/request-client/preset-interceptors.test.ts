import type { InternalAxiosRequestConfig } from 'axios';

import MockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { authenticateResponseInterceptor } from './preset-interceptors';
import { RequestClient } from './request-client';

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function setupProtectedClient() {
  const client = new RequestClient();
  const mock = new MockAdapter(client.instance);
  let currentToken = 'expired-token';

  client.addRequestInterceptor({
    fulfilled: async (config: InternalAxiosRequestConfig) => {
      config.headers.Authorization = `Bearer ${currentToken}`;
      return config;
    },
  });
  mock
    .onGet('/protected')
    .reply((config) =>
      config.headers?.Authorization === 'Bearer fresh-token'
        ? [200, { value: 'ok' }]
        : [401, { message: 'expired' }],
    );

  return {
    client,
    mock,
    setCurrentToken: (token: string) => {
      currentToken = token;
    },
  };
}

describe('authenticateResponseInterceptor', () => {
  const mocks: MockAdapter[] = [];

  afterEach(() => {
    mocks.splice(0).forEach((mock) => mock.restore());
  });

  it('shares one refresh operation across concurrent unauthorized requests', async () => {
    const { client, mock, setCurrentToken } = setupProtectedClient();
    mocks.push(mock);
    const refresh = createDeferred<string>();
    const doReAuthenticate = vi.fn(async () => {});
    const doRefreshToken = vi.fn(async () => {
      const token = await refresh.promise;
      setCurrentToken(token);
      return token;
    });

    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    );

    const firstRequest = client.get('/protected');
    await vi.waitFor(() => expect(client.isRefreshing).toBe(true));
    const secondRequest = client.get('/protected');
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(1));

    refresh.resolve('fresh-token');
    const responses = await Promise.all([firstRequest, secondRequest]);

    expect(responses.map((response: any) => response.data)).toEqual([
      { value: 'ok' },
      { value: 'ok' },
    ]);
    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(doReAuthenticate).not.toHaveBeenCalled();
    expect(client.refreshTokenQueue).toHaveLength(0);
    expect(client.isRefreshing).toBe(false);
  });

  it('rejects every queued request without retrying when refresh fails', async () => {
    const { client, mock } = setupProtectedClient();
    mocks.push(mock);
    const refresh = createDeferred<string>();
    const doReAuthenticate = vi.fn(async () => {});
    const doRefreshToken = vi.fn(() => refresh.promise);

    client.addResponseInterceptor(
      authenticateResponseInterceptor({
        client,
        doReAuthenticate,
        doRefreshToken,
        enableRefreshToken: true,
        formatToken: (token) => `Bearer ${token}`,
      }),
    );

    const firstRequest = client.get('/protected');
    await vi.waitFor(() => expect(client.isRefreshing).toBe(true));
    const secondRequest = client.get('/protected');
    await vi.waitFor(() => expect(client.refreshTokenQueue).toHaveLength(1));

    const refreshError = new Error('refresh failed');
    refresh.reject(refreshError);
    const results = await Promise.allSettled([firstRequest, secondRequest]);

    expect(results).toEqual([
      { reason: refreshError, status: 'rejected' },
      { reason: refreshError, status: 'rejected' },
    ]);
    expect(doRefreshToken).toHaveBeenCalledTimes(1);
    expect(doReAuthenticate).toHaveBeenCalledTimes(1);
    expect(mock.history.get).toHaveLength(2);
    expect(client.refreshTokenQueue).toHaveLength(0);
    expect(client.isRefreshing).toBe(false);
  });
});

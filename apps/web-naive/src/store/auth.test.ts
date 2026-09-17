import type { Router } from 'vue-router';

import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { initStores, useAccessStore, useUserStore } from '@vben/stores';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createInitialRoutes } from '#/router/reset';

import { useAuthStore } from './auth';

let router: Router;
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  user: vi.fn(),
}));
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => router,
}));
vi.mock('#/api', () => ({
  loginApi: mocks.login,
  logoutApi: mocks.logout,
  getUserInfoApi: mocks.user,
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/naive', () => ({ notification: { success: vi.fn() } }));

beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  await initStores(createApp({}), { namespace: 'auth-navigation-test' });
  router = createRouter({
    history: createMemoryHistory(),
    routes: createInitialRoutes(),
  });
  vi.spyOn(router, 'push').mockResolvedValue();
  vi.spyOn(router, 'replace').mockResolvedValue();
  router.addRoute('Root', {
    name: 'PreviousUserPage',
    path: '/previous',
    component: {},
  });
  useAccessStore().setIsAccessChecked(true);
  useAccessStore().setAccessRoutes([
    { name: 'PreviousUserPage', path: '/previous', component: {} },
  ]);
  useAccessStore().setAccessToken('previous-token');
  mocks.login.mockResolvedValue({
    accessToken: 'new-token',
    refreshToken: 'new-refresh',
    expiresIn: 900,
  });
  mocks.user.mockResolvedValue({
    userId: '2',
    username: 'new-user',
    realName: 'New user',
    roles: [],
  });
});

describe('authentication route lifecycle', () => {
  it('clears previous routes before initializing a new login', async () => {
    await useAuthStore().authLogin({
      username: 'new-user',
      password: 'Valid-pass123',
    });
    expect(router.hasRoute('PreviousUserPage')).toBe(false);
    expect(useAccessStore().isAccessChecked).toBe(false);
    expect(useAccessStore().accessRoutes).toEqual([]);
    expect(useAccessStore().accessToken).toBe('new-token');
    expect(router.push).toHaveBeenCalledOnce();
  });

  it('reenters the route guard after an expired-login modal succeeds', async () => {
    useAccessStore().setLoginExpired(true);
    await useAuthStore().authLogin({
      username: 'new-user',
      password: 'Valid-pass123',
    });
    expect(useAccessStore().loginExpired).toBe(false);
    expect(router.replace).toHaveBeenCalledOnce();
    expect(router.hasRoute('PreviousUserPage')).toBe(false);
  });

  it('clears local routes and stores even if remote logout fails', async () => {
    mocks.logout.mockRejectedValueOnce(new Error('offline'));
    await useAuthStore().logout();
    expect(router.hasRoute('PreviousUserPage')).toBe(false);
    expect(router.hasRoute('Login')).toBe(true);
    expect(useAccessStore().accessToken).toBeNull();
    expect(useAccessStore().accessRoutes).toEqual([]);
    expect(useUserStore().userInfo).toBeNull();
  });
});

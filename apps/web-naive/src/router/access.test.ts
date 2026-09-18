import type { NavigationMenu } from '#/api/core/menu';

import { createMemoryHistory, createRouter } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateAccess } from './access';
import { createInitialRoutes, resetAccessRoutes } from './reset';
import { accessRoutes, routes } from './routes';

const mocks = vi.hoisted(() => ({ menus: vi.fn() }));
vi.mock('#/api', () => ({ getNavigationMenusApi: mocks.menus }));
vi.mock('#/adapter/naive', () => ({ message: { loading: vi.fn() } }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/layouts', () => ({ BasicLayout: {}, IFrameView: {} }));

function item(
  id: number,
  parentId = 0,
  patch: Partial<NavigationMenu> = {},
): NavigationMenu {
  return {
    id,
    parentId,
    type: 2,
    name: `数据库菜单${id}`,
    routeName: `Database${id}`,
    path: `/database-${id}`,
    component: 'system/user/index',
    icon: 'lucide:user',
    sort: id,
    visible: true,
    keepAlive: true,
    external: false,
    ...patch,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('mixed navigation with real Vben routing', () => {
  it('loads static pages and database routes, hides sidebar entries, and resets without reviving old children', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: createInitialRoutes(),
    });
    mocks.menus.mockResolvedValue({
      permissions: ['user.view'],
      items: [
        item(1, 0, { type: 1, component: '', keepAlive: false }),
        item(2, 1, { visible: false }),
        item(3, 1),
        item(4, 3),
      ],
    });
    const result = await generateAccess({
      router,
      routes: accessRoutes,
      roles: [],
    });
    expect(result.accessCodes).toEqual(['user.view']);
    expect(mocks.menus).toHaveBeenCalledOnce();
    expect(router.hasRoute('Analytics')).toBe(true);
    expect(router.hasRoute('Profile')).toBe(true);
    expect(router.hasRoute('SystemManagement')).toBe(false);
    expect(router.resolve('/database-2').name).toBe('Database2');
    const group = result.accessibleMenus.find(
      (menu) => menu.name === '数据库菜单1',
    );
    expect(group?.children?.map((menu) => menu.name)).toEqual(['数据库菜单3']);
    expect(group?.children?.[0]?.children?.[0]?.name).toBe('数据库菜单4');
    // Pages with children are siblings under the layout, not rendered inside one another.
    expect(
      router.resolve('/database-4').matched.map((route) => route.name),
    ).toEqual(['Root', 'Database4']);
    expect(router.resolve('/database-3').redirectedFrom).toBeUndefined();
    expect(
      router.getRoutes().find((route) => route.name === 'Database3')?.redirect,
    ).toBeUndefined();
    expect(
      router.getRoutes().find((route) => route.name === 'Database3')?.meta
        .keepAlive,
    ).toBe(true);
    expect(routes.find((route) => route.name === 'Root')?.children).toEqual([]);

    resetAccessRoutes(router);
    expect(router.hasRoute('Database2')).toBe(false);
    expect(router.hasRoute('Analytics')).toBe(false);
    expect(router.hasRoute('Login')).toBe(true);
    mocks.menus.mockResolvedValue({ items: [], permissions: [] });
    const reloaded = await generateAccess({
      router,
      routes: accessRoutes,
      roles: [],
    });
    expect(reloaded.accessCodes).toEqual([]);
    expect(router.hasRoute('Database3')).toBe(false);
    expect(router.resolve('/database-3').name).toBe('FallbackNotFound');
    expect(router.hasRoute('Analytics')).toBe(true);
  });

  it('registers hidden detail routes and resolves their parameters with real Vben routing', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: createInitialRoutes(),
    });
    mocks.menus.mockResolvedValue({
      items: [
        item(1, 0, { path: '/order' }),
        item(2, 1, { path: '/order/:id', visible: false }),
      ],
    });
    const result = await generateAccess({
      router,
      routes: accessRoutes,
      roles: [],
    });

    for (const id of ['1001', '1002']) {
      const detail = router.resolve(`/order/${id}`);
      expect(detail.name).toBe('Database2');
      expect(detail.params).toEqual({ id });
      expect(detail.matched.map((route) => route.name)).toEqual([
        'Root',
        'Database2',
      ]);
      expect(router.resolve({ name: 'Database2', params: { id } }).path).toBe(
        `/order/${id}`,
      );
    }
    const list = result.accessibleMenus.find(
      (menu) => menu.name === '数据库菜单1',
    );
    expect(list?.path).toBe('/order');
    expect(list?.children).toEqual([]);
    expect(router.resolve('/order').name).toBe('Database1');
    expect(router.resolve('/order?id=1001').query).toEqual({ id: '1001' });
    expect(router.resolve('/auth/login').name).toBe('Login');
    expect(router.resolve('/unknown-page').name).toBe('FallbackNotFound');
  });

  it('does not install partial routes when the menu endpoint fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createRouter({
      history: createMemoryHistory(),
      routes: createInitialRoutes(),
    });
    mocks.menus.mockRejectedValueOnce(new Error('network unavailable'));
    await expect(
      generateAccess({ router, routes: accessRoutes, roles: [] }),
    ).rejects.toThrow('network unavailable');
    expect(router.hasRoute('Analytics')).toBe(false);
    vi.restoreAllMocks();
  });

  it('does not reinstall routes from a response received after logout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const router = createRouter({
      history: createMemoryHistory(),
      routes: createInitialRoutes(),
    });
    let finish!: (response: { items: NavigationMenu[] }) => void;
    mocks.menus.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const pending = generateAccess({ router, routes: accessRoutes, roles: [] });
    resetAccessRoutes(router);
    finish({ items: [item(1)] });
    await expect(pending).rejects.toThrow(
      'Navigation initialization cancelled',
    );
    expect(router.hasRoute('Database1')).toBe(false);
    expect(router.hasRoute('Login')).toBe(true);
    vi.restoreAllMocks();
  });
});

import type { RouteRecordRaw } from 'vue-router';

import type { NavigationMenu } from '#/api/core/menu';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNavigation, restoreNavigationTree } from './navigation';

function menu(id: number, patch: Partial<NavigationMenu> = {}): NavigationMenu {
  return {
    id,
    parentId: 0,
    type: 2,
    name: `菜单${id}`,
    routeName: `Menu${id}`,
    path: `/menu-${id}`,
    component: 'system/user/index',
    icon: 'lucide:user',
    sort: 0,
    visible: true,
    keepAlive: false,
    external: false,
    ...patch,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('database navigation mapping', () => {
  it('preserves literal names, hidden routes, sorting, icons and caching', () => {
    const { routes, tree } = createNavigation(
      [
        menu(3, { parentId: 1, sort: 20 }),
        menu(2, {
          parentId: 1,
          sort: 10,
          visible: false,
          keepAlive: true,
          name: 'page.system.title',
        }),
        menu(1, { type: 1, component: '' }),
      ],
      [],
    );
    expect(routes.map((route) => route.name)).toEqual([
      'Menu1',
      'Menu2',
      'Menu3',
    ]);
    expect(routes[0]?.redirect).toBe('/menu-3');
    expect(routes[1]?.meta).toMatchObject({
      title: 'page.system.title',
      hideInMenu: true,
      keepAlive: true,
      icon: 'lucide:user',
      order: 10,
    });
    expect(routes.every((route) => !route.children)).toBe(true);
    expect(routes[1]?.meta?.menuBreadcrumbs).toEqual([
      { path: '/menu-1', title: '菜单1', icon: 'lucide:user' },
      { path: '/menu-2', title: 'page.system.title', icon: 'lucide:user' },
    ]);
    expect(routes[1]?.meta?.titleIsLiteral).toBe(true);
    expect(tree[0]?.children).toHaveLength(2);
  });

  it('keeps pages with child menus independently routable', () => {
    const { routes, tree } = createNavigation(
      [menu(1), menu(2, { parentId: 1 })],
      [],
    );
    expect(routes[0]).toMatchObject({
      component: 'system/user/index',
      path: '/menu-1',
    });
    expect(routes[0]?.redirect).toBeUndefined();
    const generated = routes.map((route) => ({
      ...route,
      component: {},
    })) as RouteRecordRaw[];
    expect(restoreNavigationTree(tree, generated)[0]?.children?.[0]?.name).toBe(
      'Menu2',
    );
  });

  it.each(['/order/:id', '/order/:orderId/items/:itemId'])(
    'preserves the named parameters in hidden detail route %s',
    (path) => {
      const { routes } = createNavigation(
        [menu(1, { path, visible: false })],
        [],
      );
      expect(routes).toHaveLength(1);
      expect(routes[0]).toMatchObject({
        path,
        component: 'system/user/index',
        meta: { hideInMenu: true },
      });
    },
  );

  it('maps safe external links without treating a URL as a Vue route path', () => {
    const { routes } = createNavigation(
      [
        menu(1, {
          external: true,
          path: 'https://example.com/docs?q=test',
          keepAlive: true,
        }),
      ],
      [],
    );
    expect(routes[0]).toMatchObject({
      path: '/_external/menu/1',
      meta: { link: 'https://example.com/docs?q=test', keepAlive: false },
    });
  });

  it('drops elements, disconnected nodes and cycles', () => {
    const { routes } = createNavigation(
      [
        menu(1, { type: 3 }),
        menu(2, { parentId: 1 }),
        menu(3, { parentId: 4 }),
        menu(4, { parentId: 3 }),
        menu(5, { parentId: 99 }),
      ],
      [],
    );
    expect(routes).toEqual([]);
  });

  it('does not let database entries override built-in routes or each other', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reserved: RouteRecordRaw[] = [
      {
        path: '/auth',
        name: 'Authentication',
        children: [{ path: 'login', name: 'Login', component: {} }],
      },
      { name: 'Profile', path: '/profile', component: {} },
    ];
    const { routes } = createNavigation(
      [
        menu(1, { routeName: 'Login' }),
        menu(2, { path: '/AUTH/login/' }),
        menu(3, { path: '/profile' }),
        menu(4, { parentId: 3 }),
        menu(5, { path: '/good' }),
        menu(6, { path: '/GOOD/' }),
        menu(7, { routeName: 'Menu5' }),
        menu(8, { path: '/:path(.*)*' }),
        menu(9, { external: true, path: 'javascript:alert(1)' }),
        menu(10, { external: true, path: 'https://user:password@example.com' }),
        menu(11, { path: '/_external/menu/123' }),
      ],
      reserved,
    );
    expect(routes.map((route) => route.name)).toEqual(['Menu5']);
  });
});

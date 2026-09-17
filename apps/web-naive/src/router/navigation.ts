import type { RouteRecordRaw } from 'vue-router';

import type { RouteMeta, RouteRecordStringComponent } from '@vben/types';

import type { NavigationMenu } from '#/api/core/menu';

const externalPrefix = '/_external/menu/';
const notFoundComponent = '_core/fallback/not-found';

function normalizedPath(path: string) {
  return path.replace(/\/+$/, '').toLowerCase() || '/';
}

export function createNavigation(
  items: NavigationMenu[],
  reservedRoutes: RouteRecordRaw[],
) {
  const names = new Set<string>();
  const paths = new Set<string>();
  function reserve(routes: RouteRecordRaw[], parent = '') {
    for (const route of routes) {
      const path = route.path.startsWith('/')
        ? route.path
        : `${parent}/${route.path}`;
      if (route.name) names.add(String(route.name));
      paths.add(normalizedPath(path));
      reserve(route.children ?? [], path);
    }
  }
  reserve(reservedRoutes);

  const children = new Map<number, NavigationMenu[]>();
  for (const item of items.toSorted((a, b) => a.sort - b.sort || a.id - b.id)) {
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  const visited = new Set<number>();
  function build(
    parentId: number,
    ancestors: NonNullable<RouteMeta['menuBreadcrumbs']> = [],
  ): RouteRecordStringComponent[] {
    const result: RouteRecordStringComponent[] = [];
    for (const item of children.get(parentId) ?? []) {
      if (visited.has(item.id) || ![1, 2].includes(item.type)) continue;
      visited.add(item.id);
      const path = item.external ? `${externalPrefix}${item.id}` : item.path;
      const normalized = normalizedPath(path);
      let validLink = true;
      if (item.external) {
        try {
          const url = new URL(item.path);
          validLink =
            ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password;
        } catch {
          validLink = false;
        }
      }
      if (
        !item.routeName ||
        names.has(item.routeName) ||
        paths.has(normalized) ||
        normalized === '/auth' ||
        normalized.startsWith('/auth/') ||
        (!item.external && normalized.startsWith('/_external/')) ||
        !path.startsWith('/') ||
        path.startsWith('//') ||
        // Named params such as /order/:id are valid; catch-all patterns stay blocked.
        /[?#\\*()\s]/.test(path) ||
        path.split('/').some((part) => part === '.' || part === '..') ||
        !validLink
      ) {
        // A bad database entry must not replace login, profile or another live route.
        console.warn(
          `Ignored conflicting or invalid navigation: ${item.routeName}`,
        );
        continue;
      }
      names.add(item.routeName);
      paths.add(normalized);
      const breadcrumbs = [
        ...ancestors,
        { title: item.name, path, icon: item.icon },
      ];
      const route: RouteRecordStringComponent = {
        name: item.routeName,
        path,
        component:
          item.type === 2 && !item.external
            ? item.component
            : notFoundComponent,
        meta: {
          title: item.name,
          titleIsLiteral: true,
          menuBreadcrumbs: breadcrumbs,
          icon: item.icon,
          order: item.sort,
          hideInMenu: !item.visible,
          keepAlive: item.type === 2 && !item.external && item.keepAlive,
          ...(item.external ? { link: item.path } : {}),
        },
        children: build(item.id, breadcrumbs),
      };
      if (item.type === 1) {
        const target = firstPage(route.children ?? []);
        if (target) route.redirect = target;
      }
      result.push(route);
    }
    return result;
  }
  function firstPage(routes: RouteRecordStringComponent[]): string | undefined {
    for (const route of routes) {
      if (route.meta?.hideInMenu || route.meta?.link) continue;
      if (route.component !== notFoundComponent) return route.path;
      const target = firstPage(route.children ?? []);
      if (target) return target;
    }
  }
  const tree = build(0);
  const routes: RouteRecordStringComponent[] = [];
  function flatten(nodes: RouteRecordStringComponent[]) {
    for (const { children, ...route } of nodes) {
      routes.push(route);
      flatten(children ?? []);
    }
  }
  // Navigation hierarchy is not component nesting: an ordinary page need not
  // contain RouterView just because administrators gave it child menus.
  flatten(tree);
  return { routes, tree };
}

export function restoreNavigationTree(
  tree: RouteRecordStringComponent[],
  generatedRoutes: RouteRecordRaw[],
): RouteRecordRaw[] {
  const byName = new Map(generatedRoutes.map((route) => [route.name, route]));
  function restore(nodes: RouteRecordStringComponent[]): RouteRecordRaw[] {
    return nodes.flatMap((node) => {
      const route = byName.get(node.name);
      return route
        ? [{ ...route, children: restore(node.children ?? []) }]
        : [];
    });
  }
  return restore(tree);
}

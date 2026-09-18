import type {
  ComponentRecordType,
  GenerateMenuAndRoutesOptions,
  RouteRecordStringComponent,
} from '@vben/types';

import { generateAccessible } from '@vben/access';
import { generateMenus } from '@vben/utils';

import { message } from '#/adapter/naive';
import { getNavigationMenusApi } from '#/api';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

import { createNavigation, restoreNavigationTree } from './navigation';
import { getAccessGeneration } from './reset';
import { routes } from './routes';

const forbiddenComponent = () => import('#/views/_core/fallback/forbidden.vue');

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  const generation = getAccessGeneration();
  const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  let accessCodes: string[] = [];
  let navigationTree: RouteRecordStringComponent[] = [];
  let databaseNames = new Set<string>();
  // This is an application routing contract, not a user preference. Old persisted
  // "frontend" settings must not bypass the database's enabled/disabled menus.
  const result = await generateAccessible('mixed', {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading(`${$t('common.loadingMenu')}...`, {
        duration: 1.5,
      });
      const response = await getNavigationMenusApi();
      // Logging out while this request is pending must not reinstall old routes.
      if (generation !== getAccessGeneration()) {
        throw new Error('Navigation initialization cancelled');
      }
      accessCodes = response.permissions;
      const navigation = createNavigation(response.items, [
        ...routes,
        ...options.routes,
      ]);
      navigationTree = navigation.tree;
      databaseNames = new Set(
        navigation.routes.map((route) => String(route.name)),
      );
      return navigation.routes;
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
  const databaseTree = restoreNavigationTree(
    navigationTree,
    result.accessibleRoutes,
  );
  const menuRoutes = [
    ...databaseTree,
    ...result.accessibleRoutes.filter(
      (route) => !databaseNames.has(String(route.name)),
    ),
  ];
  return {
    ...result,
    accessCodes,
    accessibleMenus: generateMenus(menuRoutes, options.router),
  };
}

export { generateAccess };

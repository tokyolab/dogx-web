import type { Router, RouteRecordRaw } from 'vue-router';

import { cloneDeep } from '@vben/utils';

import { routes } from './routes';

let accessGeneration = 0;

export function getAccessGeneration() {
  return accessGeneration;
}

export function createInitialRoutes(): RouteRecordRaw[] {
  // Vben appends dynamic children to Root. Never give it our pristine baseline.
  return cloneDeep(routes);
}

export function resetAccessRoutes(router: Router) {
  accessGeneration++;
  router.clearRoutes();
  for (const route of createInitialRoutes()) router.addRoute(route);
}

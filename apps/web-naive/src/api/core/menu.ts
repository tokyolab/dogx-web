import { requestClient } from '#/api/request';

export interface NavigationMenu {
  id: number;
  parentId: number;
  type: number;
  name: string;
  routeName: string;
  path: string;
  component: string;
  icon: string;
  sort: number;
  visible: boolean;
  keepAlive: boolean;
  external: boolean;
}

export async function getNavigationMenusApi() {
  return requestClient.post<{ items: NavigationMenu[] }>('/auth/menus');
}

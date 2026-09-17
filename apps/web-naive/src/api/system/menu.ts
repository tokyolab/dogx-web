import { requestClient } from '#/api/request';

export namespace MenuApi {
  export interface Fields {
    parentId: number;
    type: number;
    name: string;
    routeName: string;
    path: string;
    component: string;
    permission: string;
    icon: string;
    sort: number;
    visible: boolean;
    keepAlive: boolean;
    external: boolean;
    remark: string;
  }
  export interface Item extends Fields {
    id: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }
}
export function listMenusApi() {
  return requestClient.post<{ items: MenuApi.Item[] }>('/menu/list');
}
export function getMenuApi(id: number) {
  return requestClient.post<MenuApi.Item>('/menu/get', { id });
}
export function createMenuApi(data: MenuApi.Fields & { status: number }) {
  return requestClient.post<{ id: number }>('/menu/create', data);
}
export function updateMenuApi(data: MenuApi.Fields & { id: number }) {
  return requestClient.post('/menu/update', data);
}
export function updateMenuStatusApi(id: number, status: number) {
  return requestClient.post('/menu/status/update', { id, status });
}
export function deleteMenuApi(id: number) {
  return requestClient.post('/menu/delete', { id });
}

import type { MenuApi } from './menu';

import { requestClient } from '#/api/request';

export const SUPER_ADMIN_ROLE_CODE = 'super_admin';

export namespace RoleApi {
  export interface RoleItem {
    code: string;
    createdAt: string;
    description: string;
    id: number;
    isSystem: boolean;
    name: string;
    sort: number;
    status: number;
    updatedAt: string;
  }

  export interface RoleListParams {
    keyword?: string;
    page: number;
    pageSize: number;
  }

  export interface RoleListResult {
    items: RoleItem[];
    total: number;
  }

  export interface CreateRoleParams {
    code: string;
    description?: string;
    name: string;
    sort: number;
    status: number;
  }

  export interface UpdateRoleParams {
    code: string;
    description?: string;
    id: number;
    name: string;
    sort: number;
  }

  export interface UpdateRoleStatusParams {
    id: number;
    status: number;
  }

  export interface APIItem {
    group: string;
    id: number;
    isRequired: boolean;
    method: string;
    name: string;
    path: string;
    remark: string;
    serviceName: string;
    status: number;
  }

  export interface APIListParams {
    group?: string;
    keyword?: string;
    serviceName?: string;
  }
}

export function listRolesApi(data: RoleApi.RoleListParams) {
  return requestClient.post<RoleApi.RoleListResult>('/role/list', data);
}

export function createRoleApi(data: RoleApi.CreateRoleParams) {
  return requestClient.post<{ id: number }>('/role/create', data);
}

export function updateRoleApi(data: RoleApi.UpdateRoleParams) {
  return requestClient.post('/role/update', data);
}

export function updateRoleStatusApi(data: RoleApi.UpdateRoleStatusParams) {
  return requestClient.post('/role/status/update', data);
}

export function deleteRoleApi(id: number) {
  return requestClient.post('/role/delete', { id });
}

export function listAPIsApi(data: RoleApi.APIListParams = {}) {
  return requestClient.post<{ items: RoleApi.APIItem[] }>('/api/list', data);
}

export function getRoleMenusApi(roleId: number) {
  return requestClient.post<{ items: MenuApi.Item[]; menuIds: number[] }>(
    '/role/menu/get',
    { roleId },
  );
}
export function updateRoleMenusApi(roleId: number, menuIds: number[]) {
  return requestClient.post('/role/menu/update', { roleId, menuIds });
}
export function getRoleAPIsApi(roleId: number) {
  return requestClient.post<{ apiIds: number[] }>('/role/api/get', { roleId });
}

export function updateRoleAPIsApi(roleId: number, apiIds: number[]) {
  return requestClient.post('/role/api/update', { apiIds, roleId });
}

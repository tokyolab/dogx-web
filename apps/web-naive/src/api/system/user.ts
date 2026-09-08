import { requestClient } from '#/api/request';

export namespace UserApi {
  export interface UserRole {
    code: string;
    id: number;
    name: string;
    status: number;
  }

  export interface UserItem {
    createdAt: string;
    email: string;
    id: number;
    lastLoginAt: string;
    nickname: string;
    phone: string;
    remark: string;
    roles: UserRole[];
    status: number;
    updatedAt: string;
    username: string;
  }

  export interface ListParams {
    keyword?: string;
    page: number;
    pageSize: number;
    status?: number;
  }

  export interface Profile {
    email: string;
    nickname: string;
    phone: string;
    remark: string;
  }

  export interface CreateParams extends Profile {
    password: string;
    roleIds: number[];
    status: number;
    username: string;
  }
}

export function listUsersApi(data: UserApi.ListParams) {
  return requestClient.post<{ items: UserApi.UserItem[]; total: number }>(
    '/user/list',
    data,
  );
}

export function getManagedUserApi(id: number) {
  return requestClient.post<UserApi.UserItem>('/user/get', { id });
}

export function createUserApi(data: UserApi.CreateParams) {
  return requestClient.post<{ id: number }>('/user/create', data);
}

export function updateUserApi(data: UserApi.Profile & { id: number }) {
  return requestClient.post('/user/update', data);
}

export function updateUserStatusApi(id: number, status: number) {
  return requestClient.post('/user/status/update', { id, status });
}

export function deleteUserApi(id: number) {
  return requestClient.post('/user/delete', { id });
}

export function updateUserRolesApi(id: number, roleIds: number[]) {
  return requestClient.post('/user/role/update', { id, roleIds });
}

export function resetUserPasswordApi(id: number, password: string) {
  return requestClient.post('/user/password/reset', { id, password });
}

export function listUserRoleOptionsApi(
  data: Omit<UserApi.ListParams, 'status'>,
) {
  return requestClient.post<{ items: UserApi.UserRole[]; total: number }>(
    '/user/role/options',
    data,
  );
}

import { requestClient } from '#/api/request';

export namespace DepartmentApi {
  export interface Fields {
    parentId: number;
    name: string;
    sort: number;
    remark: string;
  }
  export interface Item extends Fields {
    id: number;
    status: number;
    createdAt: string;
    updatedAt: string;
  }
}
export function listDepartmentsApi() {
  return requestClient.post<{ items: DepartmentApi.Item[] }>(
    '/department/list',
  );
}
export function getDepartmentApi(id: number) {
  return requestClient.post<DepartmentApi.Item>('/department/get', { id });
}
export function createDepartmentApi(
  data: DepartmentApi.Fields & { status: number },
) {
  return requestClient.post<{ id: number }>('/department/create', data);
}
export function updateDepartmentApi(
  data: DepartmentApi.Fields & { id: number },
) {
  return requestClient.post('/department/update', data);
}
export function updateDepartmentStatusApi(id: number, status: number) {
  return requestClient.post('/department/status/update', { id, status });
}
export function deleteDepartmentApi(id: number) {
  return requestClient.post('/department/delete', { id });
}
export function listUserDepartmentOptionsApi() {
  return requestClient.post<{ items: DepartmentApi.Item[] }>(
    '/user/department/options',
  );
}

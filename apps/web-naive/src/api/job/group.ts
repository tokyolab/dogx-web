import { requestClient } from '#/api/request';

export namespace ExecutorGroupApi {
  export interface Item {
    id: number;
    name: string;
    discoveryKey: string;
    createdAt: string;
    updatedAt: string;
  }
  export interface Detail extends Item {
    token: string;
  }
  export interface Query {
    page: number;
    pageSize: number;
    name?: string;
  }
  export interface Result {
    items: Item[];
    total: number;
  }
}

export function listExecutorGroupsApi(data: ExecutorGroupApi.Query) {
  return requestClient.post<ExecutorGroupApi.Result>('/job/group/list', data);
}
export function getExecutorGroupApi(id: number) {
  return requestClient.post<ExecutorGroupApi.Detail>('/job/group/get', { id });
}
export function createExecutorGroupApi(data: {
  discoveryKey: string;
  name: string;
}) {
  return requestClient.post<{ id: number }>('/job/group/create', data);
}
export function deleteExecutorGroupApi(id: number) {
  return requestClient.post('/job/group/delete', { id });
}

export type GroupOptionLoader = typeof listExecutorGroupsApi;

// One page shares option pages between its filter and editor. Entries expire so
// opening an editor later can discover groups created elsewhere; no credentials
// are requested or cached here.
export function createGroupOptionLoader(): GroupOptionLoader {
  const cache = new Map<
    string,
    { expires: number; request: ReturnType<GroupOptionLoader> }
  >();
  return (query) => {
    const key = JSON.stringify(query);
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.request;
    const request = listExecutorGroupsApi(query).catch((error: unknown) => {
      if (cache.get(key)?.request === request) cache.delete(key);
      throw error;
    });
    cache.set(key, { expires: Date.now() + 60_000, request });
    if (cache.size > 64) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return request;
  };
}

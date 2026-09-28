import { requestClient } from '#/api/request';

export namespace DictionaryApi {
  export interface DictionaryFields {
    name: string;
    remark: string;
    isPublic: boolean;
  }
  export interface Dictionary extends DictionaryFields {
    id: number;
    code: string;
    status: number;
    createdAt: string;
    updatedAt: string;
  }
  export interface ItemFields {
    label: string;
    sort: number;
    remark: string;
  }
  export interface Item extends ItemFields {
    id: number;
    dictionaryId: number;
    value: string;
    status: number;
    createdAt: string;
    updatedAt: string;
  }
  export interface Option {
    label: string;
    value: string;
    status: number;
    sort: number;
  }
  export interface Options {
    code: string;
    status: number;
    items: Option[];
  }
}
export const listDictionariesApi = () =>
  requestClient.post<{ items: DictionaryApi.Dictionary[] }>('/dictionary/list');
export const getDictionaryApi = (id: number) =>
  requestClient.post<{ dictionary: DictionaryApi.Dictionary }>(
    '/dictionary/get',
    { id },
  );
export const createDictionaryApi = (
  data: DictionaryApi.DictionaryFields & { code: string; status: number },
) => requestClient.post<{ id: number }>('/dictionary/create', data);
export const updateDictionaryApi = (
  data: DictionaryApi.DictionaryFields & { id: number },
) => requestClient.post('/dictionary/update', data);
export const updateDictionaryStatusApi = (id: number, status: number) =>
  requestClient.post('/dictionary/status/update', { id, status });
export const deleteDictionaryApi = (id: number) =>
  requestClient.post('/dictionary/delete', { id });
export const clearDictionaryCacheApi = () =>
  requestClient.post('/dictionary/cache/clear');
export const listDictionaryItemsApi = (dictionaryId: number) =>
  requestClient.post<{ items: DictionaryApi.Item[] }>('/dictionary/item/list', {
    dictionaryId,
  });
export const getDictionaryItemApi = (id: number) =>
  requestClient.post<{ item: DictionaryApi.Item }>('/dictionary/item/get', {
    id,
  });
export const createDictionaryItemApi = (
  data: DictionaryApi.ItemFields & {
    dictionaryId: number;
    status: number;
    value: string;
  },
) => requestClient.post<{ id: number }>('/dictionary/item/create', data);
export const updateDictionaryItemApi = (
  data: DictionaryApi.ItemFields & { id: number },
) => requestClient.post('/dictionary/item/update', data);
export const updateDictionaryItemStatusApi = (id: number, status: number) =>
  requestClient.post('/dictionary/item/status/update', { id, status });
export const deleteDictionaryItemApi = (id: number) =>
  requestClient.post('/dictionary/item/delete', { id });
export const readDictionariesApi = (codes: string[]) =>
  requestClient.post<{ items: DictionaryApi.Options[] }>('/dictionary/read', {
    codes,
  });

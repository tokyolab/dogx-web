import { requestClient } from '#/api/request';

export namespace JobDefinitionApi {
  export interface Item {
    id: number;
    name: string;
    executorGroupId: number;
    executorGroupName: null | string;
    processorName: string;
    executionMode: number;
    cronExpr: string;
    status: number;
    nextTriggerAt: null | string;
    createdAt: string;
    updatedAt: string;
  }
  export interface Input {
    name: string;
    remark: string;
    executorGroupId: number;
    processorName: string;
    executionMode: number;
    postEnabled: boolean;
    params: string;
    cronExpr: string;
    misfirePolicy: number;
    blockPolicy: number;
    maxRetries: number;
    retryIntervalSeconds: number;
    timeoutSeconds: number;
  }
  export type Detail = Input & Item;
  export interface Query {
    page: number;
    pageSize: number;
    id?: number;
    name?: string;
    executorGroupId?: number;
    status?: number;
  }
  export interface Trigger {
    id: number;
    requestId: string;
    paramsOverridden: boolean;
    params?: string;
  }
}

export function listJobDefinitionsApi(data: JobDefinitionApi.Query) {
  return requestClient.post<{ items: JobDefinitionApi.Item[]; total: number }>(
    '/job/list',
    data,
  );
}
export function getJobDefinitionApi(id: number) {
  return requestClient.post<JobDefinitionApi.Detail>('/job/get', { id });
}
export function createJobDefinitionApi(
  data: JobDefinitionApi.Input & { status: number },
) {
  return requestClient.post<{ id: number }>('/job/create', data);
}
export function updateJobDefinitionApi(
  data: JobDefinitionApi.Input & { id: number },
) {
  return requestClient.post('/job/update', data);
}
export function updateJobDefinitionStatusApi(id: number, status: number) {
  return requestClient.post('/job/status/update', { id, status });
}
export function deleteJobDefinitionApi(id: number) {
  return requestClient.post('/job/delete', { id });
}
export function previewJobCronApi(cronExpr: string) {
  return requestClient.post<{ times: string[] }>('/job/cron/preview', {
    cronExpr,
  });
}
export function triggerJobDefinitionApi(data: JobDefinitionApi.Trigger) {
  return requestClient.post<{ instanceId: number }>('/job/trigger', data);
}

import { requestClient } from '#/api/request';

export namespace JobExecutionApi {
  export interface InstanceItem {
    createdAt: string;
    deadlineAt: null | string;
    endReason: null | string;
    executorGroupId: number;
    executorGroupName: null | string;
    finishedAt: null | string;
    id: number;
    jobId: number;
    jobName: string;
    scheduledAt: null | string;
    startedAt: null | string;
    status: number;
    triggerType: number;
    updatedAt: string;
  }

  export interface ListParams {
    createdFrom?: string;
    createdTo?: string;
    executorGroupId?: number;
    id?: number;
    jobId?: number;
    jobName?: string;
    page: number;
    pageSize: number;
    status?: number;
    triggerType?: number;
  }

  export interface Page<T> {
    items: T[];
    total: number;
  }

  export interface ExecutionConfig {
    executionMode: number;
    maxRetries: number;
    params: string;
    postEnabled: boolean;
    processorName: string;
    retryIntervalSeconds: number;
    schemaVersion: number;
    timeoutSeconds: number;
  }

  export interface ShardStatistics {
    canceled: number;
    failed: number;
    succeeded: number;
    total: number;
    unfinished: number;
  }

  export interface InstanceDetail extends Omit<
    InstanceItem,
    'executorGroupName'
  > {
    executionConfig: ExecutionConfig;
    paramsOverridden: boolean;
    requestId: null | string;
    resultSummary: null | string;
    shardStats: null | ShardStatistics;
    triggeredBy: null | number;
  }

  export interface TaskItem {
    attemptNo: number;
    attemptRegisteredAt: null | string;
    createdAt: string;
    endReason: null | string;
    executorAddress: null | string;
    executorInstanceId: null | string;
    finishedAt: null | string;
    id: number;
    instanceId: number;
    nextDispatchAt: null | string;
    resultSummary: null | string;
    startedAt: null | string;
    status: number;
    taskType: number;
    updatedAt: string;
    usedAttempts: number;
  }

  export type DataKind = 'input' | 'result';

  export interface TaskDetail {
    // SQL NULL is absent data; the string "null" is a stored JSON value.
    data: null | string;
    task: TaskItem;
  }

  export interface StopResult {
    endReason: null | string;
    instanceId: number;
    status: number;
  }
}

export function listInstancesApi(data: JobExecutionApi.ListParams) {
  return requestClient.post<JobExecutionApi.Page<JobExecutionApi.InstanceItem>>(
    '/job/instance/list',
    data,
  );
}

export function getInstanceApi(id: number) {
  return requestClient.post<JobExecutionApi.InstanceDetail>(
    '/job/instance/get',
    {
      id,
    },
  );
}

export function listInstanceTasksApi(data: {
  instanceId: number;
  page: number;
  pageSize: number;
}) {
  return requestClient.post<JobExecutionApi.Page<JobExecutionApi.TaskItem>>(
    '/job/task/list',
    data,
  );
}

export function getTaskApi(id: number, dataKind?: JobExecutionApi.DataKind) {
  return requestClient.post<JobExecutionApi.TaskDetail>('/job/task/get', {
    dataKind,
    id,
  });
}

export function stopInstanceApi(id: number) {
  return requestClient.post<JobExecutionApi.StopResult>('/job/instance/stop', {
    id,
  });
}

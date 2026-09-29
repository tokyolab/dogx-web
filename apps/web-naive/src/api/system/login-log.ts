import { requestClient } from '#/api/request';

export namespace LoginLogApi {
  export interface Item {
    createdAt: string;
    failureReason: string;
    id: number;
    ipAddress: string;
    success: boolean;
    userAgent: string;
    username: string;
  }

  export interface ListParams {
    page: number;
    pageSize: number;
    result?: 'failure' | 'success';
    username?: string;
  }

  export interface ListResult {
    items: Item[];
    total: number;
  }
}

export function listLoginLogsApi(data: LoginLogApi.ListParams) {
  return requestClient.post<LoginLogApi.ListResult>('/login-log/list', data);
}

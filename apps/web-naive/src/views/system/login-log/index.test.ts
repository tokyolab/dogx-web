import type { App, Slots } from 'vue';

import type { LoginLogApi } from '#/api/system/login-log';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginLogPage from './index.vue';

const mocks = vi.hoisted(() => ({ list: vi.fn(), grid: vi.fn() }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({
  Page: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.()),
}));
vi.mock('#/api/system/login-log', () => ({ listLoginLogsApi: mocks.list }));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.grid }));

interface Options {
  gridOptions: {
    columns: { field: string; formatter?: unknown }[];
    proxyConfig: {
      ajax: {
        query: (
          params: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => Promise<LoginLogApi.ListResult>;
      };
    };
  };
}

let app: App;
let container: HTMLDivElement;
let options: Options;
const rows = [
  { success: true, failureReason: '' },
  { success: false, failureReason: 'invalid_credentials' },
  { success: false, failureReason: 'account_disabled' },
  { success: false, failureReason: 'system_error' },
  { success: false, failureReason: 'future_reason' },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue({ items: [], total: 0 });
  mocks.grid.mockImplementation((config: Options) => {
    options = config;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h(
              'div',
              rows.map((row) => slots.result?.({ row })),
            ),
      ),
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(LoginLogPage);
  app.mount(container);
});
afterEach(() => {
  app.unmount();
  container.remove();
});

describe('login log list', () => {
  it.each(['success', 'failure'])(
    'sends %s filter and pagination',
    async (result) => {
      await options.gridOptions.proxyConfig.ajax.query(
        { page: { currentPage: 2, pageSize: 20 } },
        { username: ' alice ', result },
      );
      expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
        page: 2,
        pageSize: 20,
        username: 'alice',
        result,
      });
    },
  );

  it('clears filters and preserves an empty result', async () => {
    const result = await options.gridOptions.proxyConfig.ajax.query(
      { page: { currentPage: 1, pageSize: 20 } },
      { result: null },
    );
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
      page: 1,
      pageSize: 20,
      username: '',
      result: undefined,
    });
    expect(result).toEqual({ items: [], total: 0 });
  });

  it('leaves request errors to the shared grid handling', async () => {
    mocks.list.mockRejectedValueOnce(new Error('unavailable'));
    await expect(
      options.gridOptions.proxyConfig.ajax.query(
        { page: { currentPage: 1, pageSize: 20 } },
        {},
      ),
    ).rejects.toThrow('unavailable');
  });

  it('shows status tags and translates known reasons without losing unknown ones', () => {
    expect(container.textContent).toContain('page.system.loginLog.success');
    expect(container.textContent).toContain('page.system.loginLog.failure');
    const formatter = options.gridOptions.columns.find(
      (column) => column.field === 'failureReason',
    )?.formatter;
    expect(formatter).toBeTypeOf('function');
    const format = formatter as (params: { row: unknown }) => string;
    expect(rows.map((row) => format({ row }))).toEqual([
      'page.system.loginLog.loginSuccess',
      'page.system.loginLog.invalidCredentials',
      'page.system.loginLog.accountDisabled',
      'page.system.loginLog.systemError',
      'future_reason',
    ]);
    expect(container.querySelector('button')).toBeNull();
  });
});

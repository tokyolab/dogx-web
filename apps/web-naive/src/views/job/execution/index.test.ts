import type { App, Slots } from 'vue';

import type { JobExecutionApi } from '#/api/job/execution';

import { createApp, defineComponent, h, nextTick, reactive } from 'vue';

import { NDatePicker } from 'naive-ui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ExecutionPage from './index.vue';

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  drawer: vi.fn(),
  grid: vi.fn(),
  list: vi.fn(),
  open: vi.fn(),
  reload: vi.fn(),
  route: vi.fn(),
  setData: vi.fn(),
  setValues: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('vue-router', () => ({ useRoute: mocks.route }));
vi.mock('@vben/common-ui', () => ({
  Page: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.()),
  useVbenDrawer: mocks.drawer,
  useVbenModal: vi.fn(),
}));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.grid }));
vi.mock('#/api/job/execution', () => ({ listInstancesApi: mocks.list }));
vi.mock('./instance-detail-drawer.vue', () => ({ default: {} }));

interface Options {
  formOptions: {
    schema: {
      componentProps: Record<string, unknown>;
      defaultValue?: unknown;
      fieldName: string;
    }[];
  };
  gridOptions: {
    proxyConfig: {
      ajax: {
        query: (
          context: { page: { currentPage: number; pageSize: number } },
          values: Record<string, unknown>,
        ) => Promise<JobExecutionApi.Page<JobExecutionApi.InstanceItem>>;
      };
    };
  };
}

let app: App;
let container: HTMLDivElement;
let options: Options;
let route: { query: { instanceId?: string; jobId?: string } };
let pickerApp: App | undefined;
let pickerContainer: HTMLDivElement | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  route = reactive({ query: { instanceId: '88', jobId: '42' } });
  mocks.route.mockReturnValue(route);
  mocks.close.mockResolvedValue(undefined);
  mocks.setData.mockReturnValue({ open: mocks.open });
  mocks.setValues.mockResolvedValue(undefined);
  mocks.reload.mockResolvedValue(undefined);
  mocks.list.mockResolvedValue({ items: [], total: 0 });
  const Empty = defineComponent(() => () => h('div'));
  mocks.drawer.mockImplementation(() => {
    const connectedApi = {};
    return [
      defineComponent(() => {
        Object.assign(connectedApi, {
          close: mocks.close,
          setData: mocks.setData,
        });
        return () => h('div');
      }),
      connectedApi,
    ];
  });
  mocks.grid.mockImplementation((config: Options) => {
    options = config;
    return [
      Empty,
      {
        formApi: { setValues: mocks.setValues },
        query: vi.fn(),
        reload: mocks.reload,
      },
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(ExecutionPage);
  app.mount(container);
});

afterEach(() => {
  pickerApp?.unmount();
  pickerContainer?.remove();
  pickerApp = undefined;
  pickerContainer = undefined;
  app.unmount();
  container.remove();
});

async function openRangePicker() {
  const field = options.formOptions.schema.find(
    (entry) => entry.fieldName === 'createdRange',
  );
  if (!field) throw new Error('Creation time range field is missing');
  const onUpdateValue = vi.fn();
  pickerContainer = document.createElement('div');
  document.body.append(pickerContainer);
  pickerApp = createApp(
    defineComponent(
      () => () =>
        h(NDatePicker, {
          ...field.componentProps,
          defaultCalendarStartTime: new Date(2026, 10, 1).getTime(),
          defaultCalendarEndTime: new Date(2026, 11, 1).getTime(),
          onUpdateValue,
          show: true,
          to: false,
        }),
    ),
  );
  pickerApp.mount(pickerContainer);
  await vi.waitFor(() => {
    expect(document.querySelector('.n-date-panel')).not.toBeNull();
  });
  return onUpdateValue;
}

function calendarDay(day: number) {
  const cell = [
    ...document.querySelectorAll<HTMLElement>(
      '.n-date-panel-calendar--start .n-date-panel-date',
    ),
  ].find((item) => item.textContent?.trim() === String(day));
  if (!cell) throw new Error(`Calendar day ${day} is missing`);
  return cell;
}

function rangeConfirm() {
  const button = document.querySelector<HTMLButtonElement>(
    '.n-date-panel-actions .n-button--primary-type',
  );
  if (!button) throw new Error('Range confirmation button is missing');
  return button;
}

describe('execution record list', () => {
  it('uses route Job ID as a filter and opens a linked instance without row requests', async () => {
    await nextTick();
    expect(
      options.formOptions.schema.find((field) => field.fieldName === 'jobId')
        ?.defaultValue,
    ).toBe(42);
    expect(mocks.setData).toHaveBeenCalledWith({
      id: 88,
      onChanged: expect.any(Function),
    });
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('sends backend pagination, all three trigger sources, and RFC3339 bounds', async () => {
    const from = Date.parse('2026-11-12T00:00:00Z');
    const to = Date.parse('2026-11-13T00:00:00Z');
    await options.gridOptions.proxyConfig.ajax.query(
      { page: { currentPage: 3, pageSize: 50 } },
      {
        createdRange: [from, to],
        executorGroupId: 8,
        id: 9,
        jobId: 42,
        jobName: ' cleanup ',
        status: 6,
        triggerType: 3,
      },
    );
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
      createdFrom: '2026-11-12T00:00:00.000Z',
      createdTo: '2026-11-13T00:00:00.000Z',
      executorGroupId: 8,
      id: 9,
      jobId: 42,
      jobName: 'cleanup',
      page: 3,
      pageSize: 50,
      status: 6,
      triggerType: 3,
    });
    const source = options.formOptions.schema.find(
      (field) => field.fieldName === 'triggerType',
    );
    expect(source?.componentProps).toMatchObject({
      options: [{ value: 1 }, { value: 2 }, { value: 3 }],
      placeholder: 'common.all',
    });
  });

  it('clears route filters and reloads the first page', async () => {
    route.query.jobId = undefined;
    await nextTick();
    await nextTick();
    expect(mocks.setValues).toHaveBeenCalledWith({ jobId: null });
    expect(mocks.reload).toHaveBeenCalledTimes(1);
  });

  it('clears both date bounds when the range filter is cleared', async () => {
    await options.gridOptions.proxyConfig.ajax.query(
      { page: { currentPage: 1, pageSize: 20 } },
      { createdRange: null },
    );
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ createdFrom: undefined, createdTo: undefined }),
    );
  });

  it('initializes both endpoints at midnight and disables earlier end dates', async () => {
    const onUpdateValue = await openRangePicker();
    calendarDay(12).click();
    await nextTick();
    expect(calendarDay(11).classList).toContain('n-date-panel-date--disabled');
    calendarDay(13).dispatchEvent(new MouseEvent('mouseenter'));
    await nextTick();
    calendarDay(13).click();
    await nextTick();
    expect(rangeConfirm().disabled).toBe(false);
    rangeConfirm().click();
    await nextTick();
    expect(onUpdateValue).toHaveBeenCalledWith(
      [new Date(2026, 10, 12).getTime(), new Date(2026, 10, 13).getTime()],
      expect.any(Array),
    );
  });

  it('allows the same date but requires a later end time before confirmation', async () => {
    const onUpdateValue = await openRangePicker();
    calendarDay(12).click();
    await nextTick();
    calendarDay(12).click();
    await nextTick();
    expect(rangeConfirm().disabled).toBe(true);
    expect(onUpdateValue).not.toHaveBeenCalled();
    const timeInputs = document.querySelectorAll<HTMLInputElement>(
      '.n-date-panel-header .n-time-picker input',
    );
    const endTime = timeInputs[1];
    if (!endTime) throw new Error('End time input is missing');
    expect(endTime.value).toBe('00:00:00');
    expect(endTime.readOnly).toBe(true);
    endTime.click();
    await vi.waitFor(() => {
      expect(document.querySelector('.n-time-picker-panel')).not.toBeNull();
    });
    const seconds = document.querySelectorAll<HTMLElement>(
      '.n-time-picker-col:nth-child(3) .n-time-picker-col__item',
    );
    const zero = [...seconds].find((item) => item.textContent === '00');
    const one = [...seconds].find((item) => item.textContent === '01');
    if (!zero || !one) throw new Error('Second options are missing');
    expect(zero.classList).toContain('n-time-picker-col__item--disabled');
    one.click();
    await nextTick();
    expect(rangeConfirm().disabled).toBe(false);
    rangeConfirm().click();
    await nextTick();
    expect(onUpdateValue).toHaveBeenCalledWith(
      [
        new Date(2026, 10, 12).getTime(),
        new Date(2026, 10, 12, 0, 0, 1).getTime(),
      ],
      expect.any(Array),
    );
  });

  it('opens the latest route Instance when an earlier close is still pending', async () => {
    await nextTick();
    mocks.setData.mockClear();
    mocks.open.mockClear();
    let finishClose!: () => void;
    mocks.close.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishClose = resolve;
        }),
    );
    route.query.instanceId = '101';
    await nextTick();
    route.query.instanceId = '102';
    await nextTick();
    await nextTick();
    finishClose();
    await nextTick();
    expect(mocks.setData).toHaveBeenCalledExactlyOnceWith({
      id: 102,
      onChanged: expect.any(Function),
    });
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });
});

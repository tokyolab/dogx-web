import type { App } from 'vue';

import type { JobExecutionApi } from '#/api/job/execution';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import InstanceDetailDrawer from './instance-detail-drawer.vue';

const mocks = vi.hoisted(() => ({
  closeTask: vi.fn(),
  dialog: vi.fn(),
  drawer: vi.fn(),
  get: vi.fn(),
  grid: vi.fn(),
  info: vi.fn(),
  list: vi.fn(),
  modal: vi.fn(),
  openTask: vi.fn(),
  setTask: vi.fn(),
  stop: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({
  useVbenDrawer: mocks.drawer,
  useVbenModal: mocks.modal,
}));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.dialog },
  message: { info: mocks.info, success: mocks.success },
}));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.grid }));
vi.mock('#/api/job/execution', () => ({
  getInstanceApi: mocks.get,
  listInstanceTasksApi: mocks.list,
  stopInstanceApi: mocks.stop,
}));
vi.mock('./task-detail-modal.vue', () => ({ default: {} }));

interface DrawerHooks {
  onOpenChange: (open: boolean) => void;
}

function makeInstance(status = 2): JobExecutionApi.InstanceDetail {
  return {
    createdAt: '2026-11-12T10:00:00Z',
    deadlineAt: '2026-11-12T10:15:00Z',
    endReason: null,
    executionConfig: {
      executionMode: 2,
      maxRetries: 3,
      params: '{"job":"cleanup"}',
      postEnabled: true,
      processorName: 'cleanup',
      retryIntervalSeconds: 10,
      schemaVersion: 1,
      timeoutSeconds: 900,
    },
    executorGroupId: 1,
    finishedAt: null,
    id: 99,
    jobId: 7,
    jobName: 'Cleanup snapshot',
    paramsOverridden: false,
    requestId: null,
    resultSummary: null,
    scheduledAt: '2026-11-12T10:00:00Z',
    shardStats: {
      canceled: 0,
      failed: 0,
      succeeded: 1,
      total: 5,
      unfinished: 4,
    },
    startedAt: '2026-11-12T10:00:00Z',
    status,
    triggeredBy: null,
    triggerType: 1,
    updatedAt: '2026-11-12T10:00:00Z',
  };
}

let app: App;
let container: HTMLDivElement;
let hooks: DrawerHooks;
let drawerData: { id: number };
let changePage: (page: { currentPage: number; pageSize: number }) => void;

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  mocks.get.mockResolvedValue(makeInstance());
  mocks.list.mockResolvedValue({ items: [], total: 50 });
  mocks.closeTask.mockResolvedValue(undefined);
  mocks.setTask.mockReturnValue({ open: mocks.openTask });
  drawerData = { id: 99 };
  mocks.drawer.mockImplementation((config: DrawerHooks) => {
    const hasOpened = ref(false);
    hooks = {
      onOpenChange(open) {
        if (open) hasOpened.value = true;
        config.onOpenChange(open);
      },
    };
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', hasOpened.value ? slots.default?.() : undefined),
      ),
      { getData: () => drawerData, setState: vi.fn() },
    ];
  });
  mocks.modal.mockImplementation(() => {
    const connectedApi = {};
    return [
      defineComponent(() => {
        // Connected methods become available only when the child is mounted.
        Object.assign(connectedApi, {
          close: mocks.closeTask,
          setData: mocks.setTask,
        });
        return () => h('div');
      }),
      connectedApi,
    ];
  });
  mocks.grid.mockImplementation((config) => {
    changePage = config.gridEvents.pageChange;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', slots.operation?.({ row: { id: 701 } })),
      ),
      { setGridOptions: vi.fn(), setLoading: vi.fn() },
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(InstanceDetailDrawer);
  app.mount(container);
});

afterEach(() => {
  app.unmount();
  container.remove();
  vi.useRealTimers();
});

describe('instance detail actions', () => {
  it('opens lazy drawer content and closes its Task dialog when switching Instances', async () => {
    hooks.onOpenChange(true);
    await settle();
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(99);
    const taskButton = [...container.querySelectorAll('button')].find(
      (item) => item.textContent?.trim() === 'job-execution.details',
    );
    assert(taskButton, 'Missing Task detail button');
    taskButton.click();
    await settle();
    expect(mocks.setTask).toHaveBeenCalledExactlyOnceWith({ id: 701 });
    expect(mocks.openTask).toHaveBeenCalledTimes(1);

    mocks.closeTask.mockClear();
    hooks.onOpenChange(false);
    await settle();
    drawerData = { id: 100 };
    mocks.get.mockResolvedValue({ ...makeInstance(), id: 100 });
    hooks.onOpenChange(true);
    await settle();
    expect(mocks.closeTask).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenLastCalledWith(100);
    expect(mocks.openTask).toHaveBeenCalledTimes(1);
  });

  it('refreshes only the current task page and stops after close', async () => {
    hooks.onOpenChange(true);
    await settle();
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith({
      instanceId: 99,
      page: 1,
      pageSize: 20,
    });
    changePage({ currentPage: 3, pageSize: 10 });
    await settle();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.list).toHaveBeenLastCalledWith({
      instanceId: 99,
      page: 3,
      pageSize: 10,
    });
    expect(mocks.list).toHaveBeenCalledTimes(3);
    hooks.onOpenChange(false);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });

  it.each([
    [6, 'job-execution.stopRequested', false],
    [3, 'job-execution.stopState', false],
    [5, 'job-execution.stopped', true],
  ] as const)(
    'reports committed stop status %s without claiming remote completion',
    async (status, label, success) => {
      hooks.onOpenChange(true);
      await settle();
      mocks.stop.mockResolvedValue({
        instanceId: 99,
        status,
        endReason: status === 3 ? 'success' : 'manual_stop',
      });
      mocks.get.mockResolvedValue(makeInstance(status));
      const button = [...container.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === 'job-execution.stop',
      );
      assert(button, 'Missing Instance stop button');
      button.click();
      const dialogCall = mocks.dialog.mock.calls[0];
      assert(dialogCall, 'Stop action did not open its confirmation dialog');
      const [config] = dialogCall;
      assert(config, 'Stop confirmation options are missing');
      const confirm = config.onPositiveClick as () => Promise<void>;
      await confirm();
      await settle();
      expect(mocks.stop).toHaveBeenCalledExactlyOnceWith(99);
      expect(success ? mocks.success : mocks.info).toHaveBeenCalledWith(label);
      expect(success ? mocks.info : mocks.success).not.toHaveBeenCalled();
    },
  );
});

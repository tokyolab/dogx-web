import type { App } from 'vue';

import type { JobExecutionApi } from '#/api/job/execution';

import { createApp, defineComponent, h, nextTick } from 'vue';

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import TaskDetailModal from './task-detail-modal.vue';

const mocks = vi.hoisted(() => ({ get: vi.fn(), modal: vi.fn() }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({ useVbenModal: mocks.modal }));
vi.mock('#/api/job/execution', () => ({ getTaskApi: mocks.get }));

interface ModalHooks {
  onOpenChange: (open: boolean) => void;
}

function makeTask(id: number): JobExecutionApi.TaskItem {
  return {
    attemptNo: 1,
    attemptRegisteredAt: '2026-11-12T10:00:00Z',
    createdAt: '2026-11-12T10:00:00Z',
    endReason: null,
    executorAddress: '127.0.0.1:9000',
    executorInstanceId: 'process-a',
    finishedAt: null,
    id,
    instanceId: 20,
    nextDispatchAt: null,
    resultSummary: null,
    startedAt: '2026-11-12T10:00:00Z',
    status: 2,
    taskType: 3,
    updatedAt: '2026-11-12T10:00:00Z',
    usedAttempts: 1,
  };
}

let app: App;
let container: HTMLDivElement;
let hooks: ModalHooks;
let modalData: { id: number };

async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  await nextTick();
}

function click(label: string) {
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === label,
  );
  assert(button, `Missing button: ${label}`);
  button.click();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
  modalData = { id: 1 };
  mocks.get.mockImplementation(async (id: number) => ({
    data: null,
    task: makeTask(id),
  }));
  mocks.modal.mockImplementation((config: ModalHooks) => {
    hooks = config;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      ),
      { getData: () => modalData, setState: vi.fn() },
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(TaskDetailModal);
  app.mount(container);
});

afterEach(() => {
  app.unmount();
  container.remove();
  vi.useRealTimers();
});

describe('task detail business data', () => {
  it('loads only metadata on open and automatic refresh', async () => {
    hooks.onOpenChange(true);
    await settle();
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get.mock.calls.every((call) => call.length === 1)).toBe(true);
  });

  it('preserves large JSON integers and does not automatically reload data', async () => {
    hooks.onOpenChange(true);
    await settle();
    const raw = '{"orderId":9223372036854775807,"nested":[null,{"ok":true}]}';
    mocks.get.mockImplementation(async (id: number, kind?: string) => ({
      data: kind ? raw : null,
      task: makeTask(id),
    }));
    click('job-execution.loadInput');
    await settle();
    expect(container.querySelector('pre.bg-muted')?.textContent).toBe(raw);
    await vi.advanceTimersByTimeAsync(5000);
    expect(
      mocks.get.mock.calls.filter((call) => call[1] === 'input'),
    ).toHaveLength(1);
    expect(container.querySelector('pre.bg-muted')?.textContent).toBe(raw);
  });

  it('distinguishes absent data from a saved JSON null value', async () => {
    hooks.onOpenChange(true);
    await settle();
    click('job-execution.loadInput');
    await settle();
    expect(container.textContent).toContain('job-execution.dataAbsent');
    mocks.get.mockResolvedValueOnce({ data: 'null', task: makeTask(1) });
    click('job-execution.loadResult');
    await settle();
    expect(container.textContent).not.toContain('job-execution.dataAbsent');
    expect(container.querySelector('pre.bg-muted')?.textContent).toBe('null');
  });

  it('does not apply a payload returned after closing and opening a different task', async () => {
    hooks.onOpenChange(true);
    await settle();
    let finish!: (value: JobExecutionApi.TaskDetail) => void;
    mocks.get.mockImplementation((id: number, kind?: string) =>
      kind
        ? new Promise<JobExecutionApi.TaskDetail>((resolve) => {
            finish = resolve;
          })
        : Promise.resolve({ data: null, task: makeTask(id) }),
    );
    click('job-execution.loadInput');
    await settle();
    hooks.onOpenChange(false);
    modalData = { id: 2 };
    hooks.onOpenChange(true);
    await settle();
    finish({ data: '{"old":true}', task: makeTask(1) });
    await settle();
    expect(container.querySelector('pre.bg-muted')).toBeNull();
    expect(container.textContent).not.toContain('"old"');
    expect(mocks.get).toHaveBeenLastCalledWith(2);
  });
});

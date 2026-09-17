import type { App, Slots } from 'vue';

import type { MenuApi } from '#/api/system/menu';

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

import MenuPage from './index.vue';
import { menuPayload, newMenuValues } from './menu-form';

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  list: vi.fn(),
  query: vi.fn(),
  success: vi.fn(),
  updateStatus: vi.fn(),
  useGrid: vi.fn(),
  useModal: vi.fn(),
}));

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({
  Page: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.()),
  useVbenModal: mocks.useModal,
}));
vi.mock('#/adapter/naive', () => ({
  message: { success: mocks.success },
}));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.useGrid }));
vi.mock('#/api/system/menu', () => ({
  deleteMenuApi: mocks.delete,
  listMenusApi: mocks.list,
  updateMenuStatusApi: mocks.updateStatus,
}));
vi.mock('./menu-form-modal.vue', () => ({ default: {} }));

const rows = ref<MenuApi.Item[]>([]);
let app: App | undefined;
let container: HTMLDivElement;

const Grid = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h(
        'div',
        rows.value.map((row) =>
          h('div', { 'data-row': row.id, key: row.id }, [
            slots.status?.({ row }),
            slots.operation?.({ row }),
          ]),
        ),
      ),
});

function item(id: number, status = 1, type = 2): MenuApi.Item {
  return {
    ...menuPayload(newMenuValues(0, type)),
    id,
    name: `Menu ${id}`,
    status,
    createdAt: '',
    updatedAt: '',
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

async function flush() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  await nextTick();
}

function mount(items = [item(1)]) {
  rows.value = items;
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(MenuPage);
  app.mount(container);
}

function button(text: string, parent: ParentNode = container) {
  const element = [...parent.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === text,
  );
  assert(element);
  return element;
}

function statusSwitch() {
  const element = container.querySelector<HTMLElement>('[role="switch"]');
  assert(element);
  return element;
}

function confirmation() {
  const element = document.querySelector('.n-popconfirm');
  assert(element);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  mocks.query.mockResolvedValue(undefined);
  mocks.useGrid.mockReturnValue([Grid, { query: mocks.query }]);
  mocks.useModal.mockReturnValue([() => null, {}]);
});

afterEach(async () => {
  app?.unmount();
  app = undefined;
  await flush();
  container?.remove();
  vi.useRealTimers();
});

describe('menu list actions', () => {
  it('shows switches and direct deletion without a More dropdown', () => {
    mount([item(1), item(2, 0, 3)]);
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(2);
    expect(container.textContent).not.toContain('page.system.menu.more');
    expect(button('common.delete').disabled).toBe(false);
    const elementRow = container.querySelector('[data-row="2"]');
    assert(elementRow);
    expect(elementRow.textContent).not.toContain('page.system.menu.addChild');
  });

  it('does not change status or send a request when confirmation is cancelled', async () => {
    mount();
    statusSwitch().click();
    await flush();
    expect(confirmation().textContent).toContain(
      'page.system.menu.disableConfirm',
    );
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    button('common.cancel', confirmation()).click();
    await flush();
    expect(document.querySelector('.n-popconfirm')).toBeNull();
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    'confirms status %s once and closes the popup before reloading',
    async (status) => {
      const request = deferred();
      const reload = deferred();
      mocks.updateStatus.mockReturnValueOnce(request.promise);
      mocks.query.mockReturnValueOnce(reload.promise);
      mount([item(1, status)]);
      statusSwitch().click();
      await flush();
      const confirm = button('common.confirm', confirmation());
      confirm.click();
      confirm.click();
      expect(mocks.updateStatus).toHaveBeenCalledExactlyOnceWith(
        1,
        status === 1 ? 0 : 1,
      );
      await flush();
      expect(document.querySelector('.n-popconfirm')).toBeNull();
      expect(statusSwitch().getAttribute('aria-checked')).toBe(
        String(status === 1),
      );
      statusSwitch().click();
      await flush();
      expect(document.querySelector('.n-popconfirm')).toBeNull();
      expect(button('common.delete').disabled).toBe(true);

      request.resolve();
      await flush();
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
        status === 1
          ? 'page.system.menu.disableSuccess'
          : 'page.system.menu.enableSuccess',
      );
      expect(mocks.query).toHaveBeenCalledTimes(1);
      expect(button('common.delete').disabled).toBe(true);
      rows.value = [item(1, status === 1 ? 0 : 1)];
      reload.resolve();
      await flush();
      expect(statusSwitch().getAttribute('aria-checked')).toBe(
        String(status !== 1),
      );
      expect(button('common.delete').disabled).toBe(false);
    },
  );

  it('keeps the original status and allows retry after an update failure', async () => {
    mocks.updateStatus.mockRejectedValueOnce(new Error('failed'));
    mount();
    statusSwitch().click();
    await flush();
    button('common.confirm', confirmation()).click();
    await flush();
    expect(statusSwitch().getAttribute('aria-checked')).toBe('true');
    expect(button('common.delete').disabled).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    statusSwitch().click();
    await flush();
    expect(confirmation().textContent).toContain(
      'page.system.menu.disableConfirm',
    );
  });

  it('requires confirmation for direct deletion and prevents duplicate requests', async () => {
    const request = deferred();
    mocks.delete.mockReturnValueOnce(request.promise);
    mount();
    button('common.delete').click();
    await flush();
    expect(confirmation().textContent).toContain(
      'page.system.menu.deleteConfirm',
    );
    button('common.cancel', confirmation()).click();
    await flush();
    expect(mocks.delete).not.toHaveBeenCalled();

    button('common.delete').click();
    await flush();
    const confirm = button('common.delete', confirmation());
    confirm.click();
    confirm.click();
    expect(mocks.delete).toHaveBeenCalledExactlyOnceWith(1);
    await flush();
    expect(document.querySelector('.n-popconfirm')).toBeNull();
    expect(button('common.delete').disabled).toBe(true);
    statusSwitch().click();
    await flush();
    expect(document.querySelector('.n-popconfirm')).toBeNull();
    request.resolve();
    await flush();
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
      'page.system.menu.deleteSuccess',
    );
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(button('common.delete').disabled).toBe(false);
  });

  it('releases deletion controls after a failed request without refreshing the list', async () => {
    mocks.delete.mockRejectedValueOnce(new Error('failed'));
    mount();
    button('common.delete').click();
    await flush();
    button('common.delete', confirmation()).click();
    await flush();
    expect(button('common.delete').disabled).toBe(false);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    button('common.delete').click();
    await flush();
    expect(confirmation().textContent).toContain(
      'page.system.menu.deleteConfirm',
    );
  });
});

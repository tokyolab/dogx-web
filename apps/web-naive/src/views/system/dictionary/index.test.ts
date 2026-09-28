import type { App, Slots } from 'vue';

import type { DictionaryApi } from '#/api/system/dictionary';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DictionaryPage from './index.vue';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  items: vi.fn(),
  clear: vi.fn(),
  success: vi.fn(),
  useGrid: vi.fn(),
  useModal: vi.fn(),
  warning: vi.fn(),
  setData: vi.fn(),
  open: vi.fn(),
  updateStatus: vi.fn(),
  deleteDictionary: vi.fn(),
  updateItemStatus: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({
  Page: (_: unknown, { slots }: { slots: Slots }) =>
    h('div', slots.default?.()),
  useVbenModal: mocks.useModal,
}));
vi.mock('#/adapter/naive', () => ({
  message: { success: mocks.success },
  dialog: { warning: mocks.warning },
}));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.useGrid }));
vi.mock('#/api/system/dictionary', () => ({
  listDictionariesApi: mocks.list,
  listDictionaryItemsApi: mocks.items,
  clearDictionaryCacheApi: mocks.clear,
  deleteDictionaryApi: mocks.deleteDictionary,
  deleteDictionaryItemApi: mocks.deleteItem,
  updateDictionaryStatusApi: mocks.updateStatus,
  updateDictionaryItemStatusApi: mocks.updateItemStatus,
}));
vi.mock('./dictionary-form-modal.vue', () => ({ default: {} }));

interface QueryResult {
  items: unknown[];
}
interface GridOptions {
  gridOptions: {
    proxyConfig: {
      ajax: {
        query: (
          params: unknown,
          values: Record<string, unknown>,
        ) => Promise<QueryResult>;
      };
    };
  };
}
let itemQuery: () => Promise<QueryResult>;
const itemRows = ref<unknown[]>([]);
let app: App;
let container: HTMLDivElement;
function row(id: number): DictionaryApi.Dictionary {
  return {
    id,
    name: `Dictionary ${id}`,
    code: `dict${id}`,
    status: 1,
    isPublic: false,
    remark: '',
    createdAt: '',
    updatedAt: '',
  };
}
const ItemGrid = defineComponent(
  (_, { slots }) =>
    () =>
      h(
        'div',
        itemRows.value.map((item) => {
          const row = {
            status: 1,
            ...(item as { id: number; status?: number }),
          };
          return h('div', { 'data-row': row.id, key: Number(row.id) }, [
            slots.status?.({ row }),
            slots.operation?.({ row }),
          ]);
        }),
      ),
);
beforeEach(() => {
  vi.resetAllMocks();
  itemRows.value = [];
  mocks.list.mockResolvedValue({ items: [row(1), row(2)] });
  mocks.items.mockImplementation(async (id: number) => ({
    items: [{ id, dictionaryId: id, label: `Item ${id}` }],
  }));
  mocks.clear.mockResolvedValue({});
  mocks.useGrid.mockImplementation((options: GridOptions) => {
    const query = () => options.gridOptions.proxyConfig.ajax.query({}, {});
    itemQuery = async () => {
      const result = await query();
      itemRows.value = result.items;
      return result;
    };
    return [ItemGrid, { query: itemQuery }];
  });
  mocks.setData.mockReturnValue({ open: mocks.open });
  mocks.useModal.mockReturnValue([() => null, { setData: mocks.setData }]);
  container = document.createElement('div');
  document.body.append(container);
});
function mount() {
  app = createApp(DictionaryPage);
  app.mount(container);
}
afterEach(() => {
  app?.unmount();
  container.remove();
});
function button(text: string) {
  const result = [...container.querySelectorAll('button')].find((v) =>
    v.textContent?.includes(text),
  );
  if (!result) throw new Error(`button not found: ${text}`);
  return result;
}
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected test element');
  return value;
}
async function flush() {
  for (let i = 0; i < 6; i++) await nextTick();
}
async function reloadList() {
  button('page.system.dictionary.createTitle').click();
  await mocks.setData.mock.lastCall?.[0].onSuccess();
  await flush();
}
describe('dictionary master/detail list', () => {
  it.each([false, true])(
    'shows dictionary deletion loading on More and releases it (failure: %s)',
    async (failure) => {
      let finish!: () => void;
      let fail!: (error: Error) => void;
      mocks.deleteDictionary.mockReturnValueOnce(
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      mount();
      await flush();
      const more = (id: number) =>
        required(
          container.querySelector<HTMLButtonElement>(
            `button[aria-label="Dictionary ${id} · page.system.dictionary.more"]`,
          ),
        );
      more(2).click();
      await flush();
      required(
        [
          ...document.querySelectorAll<HTMLElement>('.n-dropdown-option-body'),
        ].find((element) => element.textContent === 'common.delete'),
      ).click();
      await flush();
      expect(mocks.deleteDictionary).not.toHaveBeenCalled();
      const confirm = mocks.warning.mock.lastCall?.[0].onPositiveClick;
      expect(confirm()).toBe(true);
      expect(confirm()).toBe(false);
      await flush();
      expect(mocks.deleteDictionary).toHaveBeenCalledExactlyOnceWith(2);
      expect(more(2).classList.contains('n-button--loading')).toBe(true);
      expect(more(1).classList.contains('n-button--loading')).toBe(false);
      expect(
        container.querySelector('[data-row] .n-button--loading'),
      ).toBeNull();
      expect(more(2).disabled).toBe(true);
      let reload!: (value: { items: DictionaryApi.Dictionary[] }) => void;
      mocks.list.mockReturnValueOnce(
        new Promise<{ items: DictionaryApi.Dictionary[] }>((resolve) => {
          reload = resolve;
        }),
      );
      if (failure) fail(new Error('failed'));
      else finish();
      await flush();
      expect(more(2).classList.contains('n-button--loading')).toBe(!failure);
      expect(more(2).disabled).toBe(!failure);
      reload({ items: [row(1)] });
      await flush();
      expect(
        container.querySelector(
          'button[aria-label="Dictionary 2 · page.system.dictionary.more"]',
        ) !== null,
      ).toBe(failure);
      expect(more(1).disabled).toBe(false);
      expect(mocks.list).toHaveBeenCalledTimes(failure ? 1 : 2);
      expect(mocks.success.mock.calls).toEqual(
        failure ? [] : [['common.deleteSuccess']],
      );
    },
  );
  it('uses component ellipsis rather than native title hints for names and codes', async () => {
    const name = '长字典名称'.repeat(25);
    const code = 'a'.repeat(64);
    mocks.list.mockResolvedValue({ items: [{ ...row(1), name, code }] });
    mount();
    await flush();
    const ellipses = [...container.querySelectorAll('.n-ellipsis')];
    expect(ellipses.map((element) => element.textContent?.trim())).toEqual([
      name,
      code,
      name,
      code,
    ]);
    expect(container.querySelector('[title]')).toBeNull();
    expect(button(name).getAttribute('aria-pressed')).toBe('true');
  });
  it.each([0, 1])(
    'toggles dictionary status %s without selecting it or spinning item switches',
    async (status) => {
      mocks.list.mockResolvedValue({ items: [row(1), { ...row(2), status }] });
      let finish!: () => void;
      mocks.updateStatus.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      mount();
      await flush();
      const active = () =>
        required(
          container.querySelector<HTMLElement>(
            '[role="switch"][aria-label="Dictionary 2 · page.system.dictionary.status"]',
          ),
        );
      active().click();
      await flush();
      expect(mocks.updateStatus).not.toHaveBeenCalled();
      expect(button('Dictionary 1').getAttribute('aria-pressed')).toBe('true');
      const confirm = required(
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            '.n-popconfirm button',
          ),
        ].find((v) => v.textContent?.includes('common.confirm')),
      );
      confirm.click();
      confirm.click();
      await flush();
      expect(mocks.updateStatus).toHaveBeenCalledExactlyOnceWith(
        2,
        status === 1 ? 0 : 1,
      );
      expect(active().classList.contains('n-switch--loading')).toBe(true);
      expect(container.querySelectorAll('.n-switch--loading')).toHaveLength(1);
      expect(
        container.querySelector('[data-row] .n-switch--loading'),
      ).toBeNull();
      mocks.list.mockResolvedValue({
        items: [row(1), { ...row(2), status: status === 1 ? 0 : 1 }],
      });
      finish();
      await flush();
      expect(active().classList.contains('n-switch--loading')).toBe(false);
      expect(active().getAttribute('aria-checked')).toBe(String(status !== 1));
      expect(button('Dictionary 1').getAttribute('aria-pressed')).toBe('true');
      expect(mocks.items).toHaveBeenCalledOnce();
    },
  );
  it('keeps dictionary status unchanged and releases loading after a failed toggle', async () => {
    mocks.updateStatus.mockRejectedValueOnce(new Error('failed'));
    mount();
    await flush();
    const active = required(
      container.querySelector<HTMLElement>(
        '[role="switch"][aria-label="Dictionary 2 · page.system.dictionary.status"]',
      ),
    );
    active.click();
    await flush();
    required(
      [
        ...document.querySelectorAll<HTMLButtonElement>('.n-popconfirm button'),
      ].find((v) => v.textContent?.includes('common.confirm')),
    ).click();
    await flush();
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.classList.contains('n-switch--loading')).toBe(false);
    expect(active.classList.contains('n-switch--disabled')).toBe(false);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(button('Dictionary 1').getAttribute('aria-pressed')).toBe('true');
  });
  it.each([false, true])(
    'shows loading only on the deleting item and recovers (failure: %s)',
    async (failure) => {
      const rows = [
        { id: 11, label: 'First' },
        { id: 12, label: 'Second' },
      ];
      mocks.items.mockResolvedValue({ items: rows });
      let finish!: () => void;
      let fail!: (error: Error) => void;
      mocks.deleteItem.mockReturnValueOnce(
        new Promise<void>((resolve, reject) => {
          finish = resolve;
          fail = reject;
        }),
      );
      mount();
      await flush();
      const deleteButton = (id: number) =>
        required(
          [
            ...container.querySelectorAll<HTMLButtonElement>(
              `[data-row="${id}"] button`,
            ),
          ].find((v) => v.textContent?.includes('common.delete')),
        );
      const active = deleteButton(11);
      active.click();
      await flush();
      expect(mocks.deleteItem).not.toHaveBeenCalled();
      const confirm = required(
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            '.n-popconfirm button',
          ),
        ].find((v) => v.textContent?.includes('common.delete')),
      );
      confirm.click();
      confirm.click();
      await flush();
      expect(mocks.deleteItem).toHaveBeenCalledExactlyOnceWith(11);
      expect(active.classList.contains('n-button--loading')).toBe(true);
      expect(deleteButton(12).classList.contains('n-button--loading')).toBe(
        false,
      );
      expect(deleteButton(12).disabled).toBe(true);
      expect(container.querySelector('.n-switch--loading')).toBeNull();
      let reload!: (value: QueryResult) => void;
      mocks.items.mockReturnValueOnce(
        new Promise<QueryResult>((resolve) => {
          reload = resolve;
        }),
      );
      if (failure) fail(new Error('failed'));
      else finish();
      await flush();
      expect(active.classList.contains('n-button--loading')).toBe(!failure);
      expect(active.disabled).toBe(!failure);
      reload({ items: [rows[1]] });
      await flush();
      expect(container.querySelector('[data-row="11"]') !== null).toBe(failure);
      expect(deleteButton(12).disabled).toBe(false);
      expect(mocks.items).toHaveBeenCalledTimes(failure ? 1 : 2);
      expect(mocks.success.mock.calls).toEqual(
        failure ? [] : [['common.deleteSuccess']],
      );
    },
  );
  it.each([0, 1])(
    'shows loading only on the active switch until status %s and list reload complete',
    async (status) => {
      const rows = [
        { id: 11, label: 'First', status },
        { id: 12, label: 'Second', status: 1 },
      ];
      mocks.items.mockResolvedValue({ items: rows });
      let finish!: () => void;
      mocks.updateItemStatus.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      mount();
      await flush();
      let reload!: (result: QueryResult) => void;
      mocks.items.mockReturnValueOnce(
        new Promise<QueryResult>((resolve) => {
          reload = resolve;
        }),
      );
      const active = () =>
        required(
          container.querySelector<HTMLElement>(
            '[data-row="11"] [role="switch"]',
          ),
        );
      const other = () =>
        required(
          container.querySelector<HTMLElement>(
            '[data-row="12"] [role="switch"]',
          ),
        );
      active().click();
      await flush();
      const confirm = required(
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            '.n-popconfirm button',
          ),
        ].find((v) => v.textContent?.includes('common.confirm')),
      );
      confirm.click();
      confirm.click();
      await flush();
      expect(mocks.updateItemStatus).toHaveBeenCalledExactlyOnceWith(
        11,
        status === 1 ? 0 : 1,
      );
      expect(active().classList.contains('n-switch--loading')).toBe(true);
      expect(other().classList.contains('n-switch--loading')).toBe(false);
      expect(active().getAttribute('aria-checked')).toBe(String(status === 1));
      expect(other().classList.contains('n-switch--disabled')).toBe(true);
      finish();
      await flush();
      expect(active().classList.contains('n-switch--loading')).toBe(true);
      reload({
        items: [{ ...rows[0], status: status === 1 ? 0 : 1 }, rows[1]],
      });
      await flush();
      expect(active().classList.contains('n-switch--loading')).toBe(false);
      expect(active().getAttribute('aria-checked')).toBe(String(status !== 1));
      expect(other().classList.contains('n-switch--disabled')).toBe(false);
      expect(mocks.success).toHaveBeenCalledWith(
        status === 1 ? 'common.disableSuccess' : 'common.enableSuccess',
      );
    },
  );
  it('clears switch loading and preserves the original status after failure', async () => {
    let fail!: (error: Error) => void;
    mocks.updateItemStatus.mockReturnValueOnce(
      new Promise<void>((_resolve, reject) => {
        fail = reject;
      }),
    );
    mount();
    await flush();
    const active = required(
      container.querySelector<HTMLElement>('[data-row] [role="switch"]'),
    );
    active.click();
    await flush();
    required(
      [
        ...document.querySelectorAll<HTMLButtonElement>('.n-popconfirm button'),
      ].find((v) => v.textContent?.includes('common.confirm')),
    ).click();
    await flush();
    expect(active.classList.contains('n-switch--loading')).toBe(true);
    fail(new Error('failed'));
    await flush();
    expect(active.classList.contains('n-switch--loading')).toBe(false);
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.classList.contains('n-switch--disabled')).toBe(false);
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(mocks.success).not.toHaveBeenCalled();
  });
  it.each(['edit', 'delete'])(
    'targets the correct dictionary through the %s menu without changing selection',
    async (action) => {
      mount();
      await flush();
      required(
        container.querySelector<HTMLButtonElement>(
          'button[aria-label="Dictionary 2 · page.system.dictionary.more"]',
        ),
      ).click();
      await flush();
      const label = `common.${action}`;
      const option = required(
        [
          ...document.querySelectorAll<HTMLElement>('.n-dropdown-option-body'),
        ].find((element) => element.textContent === label),
      );
      expect(document.querySelectorAll('.n-dropdown-option-body')).toHaveLength(
        2,
      );
      expect(option).toBeDefined();
      expect(!!option.querySelector('.text-destructive')).toBe(
        action === 'delete',
      );
      option.click();
      await flush();
      expect(button('Dictionary 1').getAttribute('aria-pressed')).toBe('true');
      expect(mocks.items).toHaveBeenCalledOnce();
      const editData = expect.objectContaining({
        id: 2,
        dictionaryId: undefined,
      });
      expect(mocks.setData.mock.calls).toEqual(
        action === 'edit' ? [[editData]] : [],
      );
      expect(mocks.open).toHaveBeenCalledTimes(action === 'edit' ? 1 : 0);
      expect(mocks.updateStatus).not.toHaveBeenCalled();
      expect(mocks.deleteDictionary).not.toHaveBeenCalled();
      if (action === 'delete') {
        const confirm = mocks.warning.mock.lastCall?.[0].onPositiveClick;
        confirm();
        confirm();
        await flush();
      }
      expect(mocks.deleteDictionary.mock.calls).toEqual(
        action === 'delete' ? [[2]] : [],
      );
      expect(mocks.success.mock.calls).toEqual(
        action === 'delete' ? [['common.deleteSuccess']] : [],
      );
    },
  );
  it('loads only the selected items and preserves selection on metadata reload', async () => {
    mount();
    await flush();
    expect(mocks.items).toHaveBeenCalledExactlyOnceWith(1);
    await reloadList();
    expect(mocks.items).toHaveBeenCalledTimes(1);
    button('Dictionary 2').click();
    await flush();
    expect(mocks.items).toHaveBeenLastCalledWith(2);
    expect(button('Dictionary 2').getAttribute('aria-pressed')).toBe('true');
    await reloadList();
    expect(mocks.items).toHaveBeenCalledTimes(2);
    expect(itemRows.value).toEqual([
      { id: 2, dictionaryId: 2, label: 'Item 2' },
    ]);
  });
  it('ignores a slower item response for the previous dictionary', async () => {
    let resolve!: (value: QueryResult) => void;
    mocks.items.mockReturnValueOnce(
      new Promise<QueryResult>((r) => {
        resolve = r;
      }),
    );
    mount();
    await flush();
    button('Dictionary 2').click();
    await flush();
    resolve({ items: [{ id: 1, dictionaryId: 1, label: 'late' }] });
    await flush();
    expect(itemRows.value).toEqual([
      { id: 2, dictionaryId: 2, label: 'Item 2' },
    ]);
  });
  it('filters names and codes locally without reloading items or losing selection', async () => {
    mount();
    await flush();
    const input = required(container.querySelector('input'));
    input.value = 'DICT2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(container.querySelectorAll('button[aria-pressed]')).toHaveLength(1);
    expect(button('Dictionary 2').getAttribute('aria-pressed')).toBe('false');
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.items).toHaveBeenCalledOnce();
    input.value = 'missing';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await flush();
    expect(container.textContent).toContain('page.system.dictionary.noMatches');
  });
  it('clears Redis once without reloading or rebuilding dictionaries', async () => {
    mount();
    await flush();
    let finish!: () => void;
    mocks.clear.mockReturnValueOnce(
      new Promise<void>((r) => {
        finish = r;
      }),
    );
    const clear = button('page.system.dictionary.refreshCache');
    clear.click();
    clear.click();
    await flush();
    expect(mocks.clear).toHaveBeenCalledOnce();
    finish();
    await flush();
    expect(mocks.list).toHaveBeenCalledOnce();
    expect(mocks.items).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith(
      'page.system.dictionary.cacheCleared',
    );
  });
  it('clears items when the selection disappears and displays the selection prompt', async () => {
    mount();
    await flush();
    mocks.list.mockResolvedValue({ items: [] });
    await reloadList();
    expect(itemRows.value).toEqual([]);
    expect(container.textContent).toContain(
      'page.system.dictionary.selectDictionary',
    );
    expect(container.textContent).toContain(
      'page.system.dictionary.noDictionaries',
    );
    expect(mocks.items).toHaveBeenCalledOnce();
  });
  it('shows retry rather than an empty-list message when list loading fails', async () => {
    mocks.list.mockRejectedValueOnce(new Error('offline'));
    mount();
    await flush();
    expect(container.textContent).toContain(
      'page.system.dictionary.loadFailed',
    );
    button('page.system.dictionary.retry').click();
    await flush();
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.items).toHaveBeenCalledExactlyOnceWith(1);
  });
});

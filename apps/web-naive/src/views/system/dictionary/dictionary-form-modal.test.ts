import type { App } from 'vue';

import type { DictionaryFormValues } from './dictionary-form';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DictionaryFormModal from './dictionary-form-modal.vue';

const mocks = vi.hoisted(() => ({
  useModal: vi.fn(),
  useForm: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  getItem: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({ useVbenModal: mocks.useModal }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/form', () => ({ useVbenForm: mocks.useForm }));
vi.mock('./dictionary-form', () => ({
  dictionaryFormSchema: () => [],
  dictionarySnapshot: (v: DictionaryFormValues) => JSON.stringify(v),
}));
vi.mock('#/adapter/naive', () => ({
  message: { success: mocks.success },
  dialog: { warning: mocks.warning },
}));
vi.mock('#/api/system/dictionary', () => ({
  createDictionaryApi: mocks.create,
  updateDictionaryApi: mocks.update,
  getDictionaryApi: mocks.get,
  createDictionaryItemApi: mocks.createItem,
  updateDictionaryItemApi: mocks.updateItem,
  getDictionaryItemApi: mocks.getItem,
}));
interface Hooks {
  onOpenChange: (open: boolean) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBeforeClose: () => Promise<boolean>;
}
let hooks: Hooks;
let data: { dictionaryId?: number; id?: number; onSuccess?: () => void };
let values: DictionaryFormValues;
let app: App;
let container: HTMLDivElement;
const api = {
  close: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  setState: vi.fn(),
  getData: () => data,
};
let valid = true;
const form = {
  setState: vi.fn(),
  resetForm: async () => {
    values = {};
  },
  getValues: async () => values,
  setValues: async (v: DictionaryFormValues) => {
    values = v;
  },
  validate: async () => ({ valid }),
};
beforeEach(() => {
  vi.clearAllMocks();
  data = {};
  values = {};
  valid = true;
  const component = defineComponent(
    (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  );
  mocks.useModal.mockImplementation((options: Hooks) => {
    hooks = options;
    return [component, api];
  });
  mocks.useForm.mockReturnValue([component, form]);
  mocks.get.mockResolvedValue({
    dictionary: { name: '来源', isPublic: false, remark: '' },
  });
  mocks.getItem.mockResolvedValue({
    item: { label: '官网', sort: 0, remark: '' },
  });
  mocks.create.mockResolvedValue({ id: 1 });
  mocks.update.mockResolvedValue({});
  mocks.createItem.mockResolvedValue({ id: 1 });
  mocks.updateItem.mockResolvedValue({});
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(DictionaryFormModal);
  app.mount(container);
});
afterEach(() => {
  app.unmount();
  container.remove();
});
describe('dictionary form lifecycle', () => {
  it('always submits unchanged edit forms and refreshes management data', async () => {
    data = { id: 7, onSuccess: vi.fn() };
    await hooks.onOpenChange(true);
    expect(await hooks.onBeforeClose()).toBe(true);
    await hooks.onConfirm();
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      id: 7,
      name: '来源',
      isPublic: false,
      remark: '',
    });
    expect(data.onSuccess).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledWith('common.saveSuccess');
  });
  it('creates dictionary items without allowing later ownership or value changes', async () => {
    data = { dictionaryId: 7 };
    await hooks.onOpenChange(true);
    values = { label: ' 官网 ', value: 'web', sort: 0, status: 1 };
    await hooks.onConfirm();
    expect(mocks.createItem).toHaveBeenCalledWith({
      dictionaryId: 7,
      label: '官网',
      value: 'web',
      sort: 0,
      status: 1,
      remark: '',
    });
    data = { id: 8, dictionaryId: 7 };
    await hooks.onOpenChange(true);
    values = { ...values, value: 'forged' };
    await hooks.onConfirm();
    expect(mocks.updateItem).toHaveBeenCalledWith({
      id: 8,
      label: '官网',
      sort: 0,
      remark: '',
    });
  });
  it('prevents duplicate submits and closing during a pending write', async () => {
    data = { id: 7 };
    await hooks.onOpenChange(true);
    let resolve!: () => void;
    mocks.update.mockReturnValue(
      new Promise<void>((r) => {
        resolve = r;
      }),
    );
    const first = hooks.onConfirm();
    await Promise.resolve();
    await Promise.resolve();
    await hooks.onConfirm();
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(mocks.update).toHaveBeenCalledOnce();
    resolve();
    await first;
  });
  it('keeps the form open after validation or save failure', async () => {
    data = { id: 7 };
    await hooks.onOpenChange(true);
    valid = false;
    await hooks.onConfirm();
    expect(mocks.update).not.toHaveBeenCalled();
    valid = true;
    mocks.update.mockRejectedValue(new Error('cache failed'));
    await expect(hooks.onConfirm()).rejects.toThrow('cache failed');
    expect(api.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(api.unlock).toHaveBeenCalledTimes(2);
  });
  it('ignores detail responses arriving after the modal closed', async () => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    data = { id: 7 };
    const open = hooks.onOpenChange(true);
    await Promise.resolve();
    await Promise.resolve();
    await hooks.onOpenChange(false);
    resolve({ dictionary: { name: 'late' } });
    await open;
    expect(values.name).not.toBe('late');
  });
});

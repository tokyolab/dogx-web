import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { newMenuValues } from './menu-form';
import MenuFormModal from './menu-form-modal.vue';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  success: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  useModal: vi.fn(),
  useForm: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', async (original) => ({
  ...(await original<typeof import('@vben/common-ui')>()),
  useVbenModal: mocks.useModal,
}));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z, useVbenForm: mocks.useForm };
});
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: mocks.success },
}));
vi.mock('#/api/system/menu', () => ({
  createMenuApi: mocks.create,
  updateMenuApi: mocks.update,
  getMenuApi: mocks.get,
}));

interface Hooks {
  onBeforeClose: () => Promise<boolean>;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => Promise<void>;
}
let hooks: Hooks;
let app: App;
let container: HTMLDivElement;
let values: Record<string, unknown>;
let data: { id?: number; items: never[]; parentId?: number; type?: number };
const api = {
  close: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  setState: vi.fn(),
  getData: () => data,
};
const form = {
  getValues: vi.fn(async () => ({ ...values })),
  resetForm: vi.fn(async () => {
    values = {};
  }),
  setValues: vi.fn(async (input: Record<string, unknown>) => {
    values = { ...input };
  }),
  setState: vi.fn(),
  validate: vi.fn(async () => ({ valid: true })),
};
const Slot = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', slots.default?.()),
});

beforeEach(() => {
  vi.clearAllMocks();
  values = {};
  data = { items: [] };
  form.validate.mockResolvedValue({ valid: true });
  mocks.create.mockResolvedValue({ id: 10 });
  mocks.update.mockResolvedValue({});
  mocks.useForm.mockReturnValue([Slot, form]);
  mocks.useModal.mockImplementation((options: Hooks) => {
    hooks = options;
    return [Slot, api];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(MenuFormModal);
  app.mount(container);
});
afterEach(() => {
  app.unmount();
  container.remove();
});
describe('menu modal lifecycle', () => {
  it('opens with a preselected parent and closes untouched without a warning', async () => {
    data.parentId = 2;
    data.type = 3;
    await hooks.onOpenChange(true);
    expect(values).toMatchObject({ parentId: 2, type: 3 });
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });
  it('loads edit details and preserves disabled status outside the update payload', async () => {
    data.id = 5;
    mocks.get.mockResolvedValue({
      ...newMenuValues(1, 2),
      id: 5,
      name: 'Page',
      visible: false,
      keepAlive: false,
      external: false,
      status: 0,
    });
    await hooks.onOpenChange(true);
    expect(mocks.get).toHaveBeenCalledWith(5);
    expect(await hooks.onBeforeClose()).toBe(true);
    values.name = 'Edited';
    await hooks.onConfirm();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        visible: false,
        name: 'Edited',
        sort: 0,
      }),
    );
    expect(mocks.update.mock.calls[0]?.[0]).not.toHaveProperty('status');
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('common.saveSuccess');
  });
  it('guards duplicate submissions before asynchronous validation completes', async () => {
    await hooks.onOpenChange(true);
    let resolve!: (result: { valid: boolean }) => void;
    form.validate.mockImplementationOnce(
      () =>
        new Promise((finish) => {
          resolve = finish;
        }),
    );
    const first = hooks.onConfirm();
    await hooks.onConfirm();
    expect(form.validate).toHaveBeenCalledTimes(1);
    resolve({ valid: true });
    await first;
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('common.saveSuccess');
  });
  it('keeps the form open after save failure and releases its lock', async () => {
    await hooks.onOpenChange(true);
    mocks.create.mockRejectedValueOnce(new Error('failed'));
    await expect(hooks.onConfirm()).rejects.toThrow('failed');
    expect(api.close).not.toHaveBeenCalled();
    expect(api.unlock).toHaveBeenCalled();
  });
  it('does not submit invalid forms', async () => {
    await hooks.onOpenChange(true);
    form.validate.mockResolvedValueOnce({ valid: false });
    await hooks.onConfirm();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(api.close).not.toHaveBeenCalled();
  });
  it('ignores a detail response that arrives after closing', async () => {
    data.id = 1;
    let resolve!: (value: unknown) => void;
    mocks.get.mockImplementationOnce(
      () =>
        new Promise((finish) => {
          resolve = finish;
        }),
    );
    const opening = hooks.onOpenChange(true);
    await nextTick();
    await nextTick();
    await hooks.onOpenChange(false);
    resolve({ ...newMenuValues(), id: 1 });
    await opening;
    expect(form.setValues).not.toHaveBeenCalled();
  });
  it('does not allow saving when detail loading fails', async () => {
    data.id = 1;
    mocks.get.mockRejectedValueOnce(new Error('missing'));
    await hooks.onOpenChange(true);
    await hooks.onConfirm();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(api.close).toHaveBeenCalled();
  });
});

import type { App } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserFormModal from './user-form-modal.vue';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  useForm: vi.fn(),
  useModal: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@vben/common-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/common-ui')>()),
  useVbenModal: mocks.useModal,
}));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { useVbenForm: mocks.useForm, z };
});
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: vi.fn() },
}));
vi.mock('#/api/system', () => ({
  createUserApi: mocks.createUser,
  getManagedUserApi: mocks.getUser,
  updateUserApi: mocks.updateUser,
}));
vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));
vi.mock('naive-ui', () => ({
  NFormItem: defineComponent(
    (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  ),
}));
vi.mock('./user-role-select.vue', () => ({ default: () => h('div') }));

interface ModalHooks {
  onBeforeClose: () => Promise<boolean>;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => Promise<void>;
}

let app: App | undefined;
let container: HTMLDivElement;
let hooks: ModalHooks;
let modalData: { id?: number };
let schema: VbenFormSchema[];
let values: Record<string, unknown>;
const formApi = {
  getValues: vi.fn(async () => ({ ...values })),
  resetForm: vi.fn(async () => {
    values = Object.fromEntries(
      schema.map((field) => [field.fieldName, field.defaultValue ?? '']),
    );
  }),
  setState: vi.fn((state: { schema: VbenFormSchema[] }) => {
    schema = state.schema;
  }),
  setValues: vi.fn(async (input: Record<string, unknown>) => {
    // Match Vben's contract: fields outside the current schema are not loaded.
    for (const field of schema) {
      values[field.fieldName] = input[field.fieldName];
    }
  }),
  validate: vi.fn(async () => ({ valid: true })),
};

beforeEach(() => {
  vi.clearAllMocks();
  modalData = {};
  values = {};
  mocks.getUser.mockResolvedValue({
    email: '',
    id: 42,
    nickname: 'Administrator',
    phone: '',
    remark: 'initial administrator',
    roles: [{ code: 'super_admin', id: 1, name: 'Super Admin', status: 1 }],
    status: 1,
    username: 'admin',
  });
  mocks.warning.mockImplementation((options: { onNegativeClick: () => void }) =>
    options.onNegativeClick(),
  );
  mocks.useForm.mockImplementation((options: { schema: VbenFormSchema[] }) => {
    schema = options.schema;
    return [() => h('div'), formApi];
  });
  mocks.useModal.mockImplementation((options: ModalHooks) => {
    hooks = options;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      ),
      {
        close: vi.fn(),
        getData: () => modalData,
        lock: vi.fn(),
        setState: vi.fn(),
        unlock: vi.fn(),
      },
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(UserFormModal);
  app.mount(container);
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  container.remove();
});

async function open(id?: number) {
  modalData = { id };
  await hooks.onOpenChange(true);
}

describe('user form unsaved changes', () => {
  it('validates new passwords in UTF-8 bytes without input truncation', async () => {
    await open();
    const field = schema.find((item) => item.fieldName === 'password');
    expect(field?.componentProps).not.toHaveProperty('maxlength');
    const rules = field?.rules as {
      safeParse: (value: string) => { success: boolean };
    };
    for (const password of ['a'.repeat(72), '密'.repeat(24), '😀'.repeat(18)]) {
      expect(rules.safeParse(password).success).toBe(true);
      expect(rules.safeParse(`${password}x`).success).toBe(false);
    }
    expect(rules.safeParse('😀'.repeat(11)).success).toBe(false);
  });

  it('closes an untouched edit form without a warning or write request', async () => {
    await open(42);
    expect(values).not.toHaveProperty('status');
    expect(values).not.toHaveProperty('password');
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it.each(['nickname', 'email', 'phone', 'remark'])(
    'still warns when the editable %s field changes',
    async (field) => {
      await open(42);
      values[field] = 'changed';
      expect(await hooks.onBeforeClose()).toBe(false);
      expect(mocks.warning).toHaveBeenCalledOnce();
    },
  );

  it('closes without warning after restoring the original value', async () => {
    await open(42);
    values.nickname = 'changed';
    expect(await hooks.onBeforeClose()).toBe(false);
    mocks.warning.mockClear();
    values.nickname = 'Administrator';
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('ignores non-editable account fields when editing a profile', async () => {
    await open(42);
    values.status = 0;
    values.password = 'not-a-profile-field';
    values.username = 'not-editable';
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('closes an untouched create form without a warning', async () => {
    await open();
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it.each([
    ['username', 'new-user'],
    ['password', 'a-new-password'],
    ['status', 0],
  ])(
    'still warns when creating a user and %s changes',
    async (field, value) => {
      await open();
      values[field] = value;
      expect(await hooks.onBeforeClose()).toBe(false);
      expect(mocks.warning).toHaveBeenCalledOnce();
    },
  );

  it('refreshes the baseline when switching between create and edit', async () => {
    await open();
    values.password = 'unsaved-new-password';
    await hooks.onOpenChange(false);
    await open(42);
    expect(await hooks.onBeforeClose()).toBe(true);
    await hooks.onOpenChange(false);
    await open();
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('updates the baseline after a successful profile save', async () => {
    await open(42);
    values.nickname = 'Updated Administrator';
    await hooks.onConfirm();
    expect(mocks.updateUser).toHaveBeenCalledWith({
      email: '',
      id: 42,
      nickname: 'Updated Administrator',
      phone: '',
      remark: 'initial administrator',
    });
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });
});

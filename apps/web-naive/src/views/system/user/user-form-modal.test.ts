import type { App, PropType } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';

import { createApp, defineComponent, h, nextTick, reactive, ref } from 'vue';

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import UserFormModal from './user-form-modal.vue';

const mocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  getUser: vi.fn(),
  messageWarning: vi.fn(),
  roleSelect: vi.fn(),
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
  message: { success: vi.fn(), warning: mocks.messageWarning },
}));
vi.mock('#/api/system', () => ({
  createUserApi: mocks.createUser,
  getManagedUserApi: mocks.getUser,
  updateUserApi: mocks.updateUser,
}));
vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));
vi.mock('./user-role-select.vue', () => ({
  default: defineComponent({
    props: {
      disabled: Boolean,
      value: { type: Array as PropType<number[]>, default: () => [] },
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () => {
        mocks.roleSelect(props, emit);
        return h('div');
      };
    },
  }),
}));

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
const formRevision = ref(0);
const formApi = {
  getValues: vi.fn(async () => ({ ...values })),
  resetForm: vi.fn(async () => {
    values = reactive(
      Object.fromEntries(
        schema.map((field) => [field.fieldName, field.defaultValue ?? '']),
      ),
    );
    formRevision.value++;
  }),
  setState: vi.fn((state: { schema: VbenFormSchema[] }) => {
    schema = state.schema;
    formRevision.value++;
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
  values = reactive({});
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
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h(
              'form',
              { 'data-revision': formRevision.value },
              schema.map((field) =>
                slots[field.fieldName]?.({
                  handleChange: (value: unknown) => {
                    values[field.fieldName] = value;
                  },
                  value: values[field.fieldName],
                }),
              ),
            ),
      ),
      formApi,
    ];
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

async function selectRoles(ids: number[]) {
  const call = mocks.roleSelect.mock.lastCall;
  assert(call);
  const emit = call[1] as (event: string, ids: number[]) => void;
  emit('update:value', ids);
  await nextTick();
}

describe('user form role field', () => {
  it('places roles immediately after the initial password without reordering other fields', async () => {
    await open();
    expect(schema.map((field) => field.fieldName)).toEqual([
      'username',
      'nickname',
      'password',
      'roleIds',
      'email',
      'phone',
      'remark',
      'status',
    ]);
  });

  it('mounts the optional role selector inside the form only after create initialization', async () => {
    expect(mocks.roleSelect).not.toHaveBeenCalled();
    await open();
    const field = schema.find((item) => item.fieldName === 'roleIds');
    expect(field).toMatchObject({
      defaultValue: [],
      label: 'page.system.user.roles',
    });
    expect(field?.rules).toBeUndefined();
    expect(mocks.roleSelect.mock.lastCall?.[0]).toMatchObject({
      disabled: false,
      value: [],
    });
    expect(container.querySelector('form > div')).not.toBeNull();
  });

  it('binds selection to form values, warns on changes and clears back to the initial state', async () => {
    await open();
    await selectRoles([7, 8]);
    expect(values.roleIds).toEqual([7, 8]);
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(mocks.warning).toHaveBeenCalledOnce();
    await selectRoles([]);
    mocks.warning.mockClear();
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('submits the selected roles and ignores selection order in the saved baseline', async () => {
    await open();
    values.username = 'reader';
    values.password = 'Abcd123!';
    await selectRoles([7, 8]);
    await hooks.onConfirm();
    expect(mocks.createUser).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ roleIds: [7, 8] }),
    );
    await selectRoles([8, 7]);
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(values.roleIds).toEqual([8, 7]);
  });

  it.each([0, 100])('still accepts %i assigned roles', async (count) => {
    await open();
    await selectRoles(Array.from({ length: count }, (_, index) => index + 1));
    await hooks.onConfirm();
    expect(mocks.createUser).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ roleIds: values.roleIds }),
    );
    expect(mocks.messageWarning).not.toHaveBeenCalled();
  });

  it('keeps the existing warning and blocks submission above 100 roles', async () => {
    await open();
    await selectRoles(Array.from({ length: 101 }, (_, index) => index + 1));
    await hooks.onConfirm();
    expect(mocks.messageWarning).toHaveBeenCalledExactlyOnceWith(
      'page.system.user.tooManyRoles',
    );
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('does not mount the selector or include roleIds when editing a profile', async () => {
    await open(42);
    expect(schema.map((field) => field.fieldName)).not.toContain('roleIds');
    expect(values).not.toHaveProperty('roleIds');
    expect(mocks.roleSelect).not.toHaveBeenCalled();
  });

  it('clears the role selection when reopening the create form', async () => {
    await open();
    await selectRoles([7, 8]);
    await hooks.onOpenChange(false);
    await open();
    expect(values.roleIds).toEqual([]);
    expect(mocks.roleSelect.mock.lastCall?.[0]).toMatchObject({ value: [] });
    expect(await hooks.onBeforeClose()).toBe(true);
  });
});

describe('user form field feedback', () => {
  it.each([
    { id: undefined, mode: 'create' },
    { id: 42, mode: 'edit' },
  ])('provides field-specific placeholders in $mode mode', async ({ id }) => {
    await open(id);
    const fields = ['username', 'nickname', 'email', 'phone', 'remark'];
    if (id === undefined) fields.push('password');
    for (const fieldName of fields) {
      expect(
        schema.find((field) => field.fieldName === fieldName)?.componentProps,
      ).toMatchObject({
        placeholder: `page.system.user.${fieldName}Placeholder`,
      });
    }
  });

  it.each([
    { id: undefined, mode: 'create' },
    { id: 42, mode: 'edit' },
  ])('shows text length counters in $mode mode', async ({ id }) => {
    await open(id);
    for (const [fieldName, maxlength] of [
      ['username', 64],
      ['nickname', 64],
      ['email', 255],
      ['phone', 32],
      ['remark', 500],
    ] as const) {
      expect(
        schema.find((field) => field.fieldName === fieldName)?.componentProps,
      ).toMatchObject({ maxlength, showCount: true });
    }
  });
});

describe('user form unsaved changes', () => {
  it('enforces the new-password policy and restricts input', async () => {
    await open();
    const field = schema.find((item) => item.fieldName === 'password');
    expect(field?.component).toBe('NewPasswordInput');
    const rules = field?.rules as {
      safeParse: (value: string) => { success: boolean };
    };
    for (const password of ['Abcd123!', `Aa1${'!'.repeat(29)}`]) {
      expect(rules.safeParse(password).success).toBe(true);
    }
    for (const password of [
      'Abc123!',
      `Aa1${'!'.repeat(30)}`,
      'Abcdefgh',
      'Abcd123!?',
    ]) {
      expect(rules.safeParse(password).success).toBe(false);
    }
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

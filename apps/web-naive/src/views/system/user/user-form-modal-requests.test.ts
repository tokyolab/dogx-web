import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { globalShareState } from '@vben/common-ui';

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { initSetupVbenForm } from '#/adapter/form';

import UserFormModal from './user-form-modal.vue';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  listOptions: vi.fn(),
  useModal: vi.fn(),
}));

// Keep the real Vben form and role selector: a form stub misses slot fallback
// mounting the schema component before the custom slot is ready.
vi.mock('@vben/common-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/common-ui')>()),
  useVbenModal: mocks.useModal,
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: vi.fn() },
  message: { success: vi.fn(), warning: vi.fn() },
}));
vi.mock('#/api/system', () => ({
  createUserApi: vi.fn(),
  getManagedUserApi: mocks.getUser,
  listUserRoleOptionsApi: mocks.listOptions,
  updateUserApi: vi.fn(),
}));
vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));

interface ModalHooks {
  onOpenChange: (open: boolean) => Promise<void>;
}

let app: App;
let container: HTMLDivElement;
let hooks: ModalHooks;
let modalData: { id?: number };
let warnings: string[];

beforeAll(async () => {
  const FieldStub = defineComponent(() => () => h('div'));
  globalShareState.setComponents({
    Input: FieldStub,
    NewPasswordInput: FieldStub,
    RadioGroup: FieldStub,
  });
  await initSetupVbenForm();
});

beforeEach(() => {
  vi.clearAllMocks();
  modalData = {};
  warnings = [];
  mocks.listOptions.mockResolvedValue({ items: [], total: 0 });
  mocks.getUser.mockResolvedValue({
    email: '',
    id: 42,
    nickname: 'Reader',
    phone: '',
    remark: '',
    roles: [],
    status: 1,
    username: 'reader',
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
  app.config.warnHandler = (warning) => warnings.push(warning);
  app.mount(container);
});

afterEach(() => {
  app.unmount();
  container.remove();
});

async function open(id?: number) {
  modalData = { id };
  await hooks.onOpenChange(true);
  await nextTick();
}

describe('user form role option requests with the real Vben form', () => {
  it('loads options once after create initialization, never from the empty slot fallback', async () => {
    expect(mocks.listOptions).not.toHaveBeenCalled();
    await open();
    expect(mocks.listOptions).toHaveBeenCalledExactlyOnceWith({
      keyword: '',
      page: 1,
      pageSize: 200,
    });
    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('Missing required prop: "value"'),
      ]),
    );
  });

  it('does not reload on close and loads once on each reopen', async () => {
    await open();
    expect(mocks.listOptions).toHaveBeenCalledTimes(1);
    await hooks.onOpenChange(false);
    await nextTick();
    expect(mocks.listOptions).toHaveBeenCalledTimes(1);
    await open();
    expect(mocks.listOptions).toHaveBeenCalledTimes(2);
  });

  it('does not load role options when opening an edit form or switching to one', async () => {
    await open(42);
    expect(mocks.getUser).toHaveBeenCalledExactlyOnceWith(42);
    expect(mocks.listOptions).not.toHaveBeenCalled();
    await hooks.onOpenChange(false);
    await open();
    expect(mocks.listOptions).toHaveBeenCalledTimes(1);
    await hooks.onOpenChange(false);
    await open(42);
    expect(mocks.listOptions).toHaveBeenCalledTimes(1);
  });
});

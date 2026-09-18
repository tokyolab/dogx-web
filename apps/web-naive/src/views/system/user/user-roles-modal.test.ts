import type { App } from 'vue';

import type { UserApi } from '#/api/system';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserRolesModal from './user-roles-modal.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  logout: vi.fn(),
  onSuccess: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  useModal: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@vben/common-ui', () => ({ useVbenModal: mocks.useModal }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ logout: mocks.logout }),
}));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: mocks.success, warning: vi.fn() },
}));
vi.mock('#/api/system', () => ({
  getManagedUserApi: mocks.get,
  updateUserRolesApi: mocks.save,
}));
vi.mock('#/api/system/role', () => ({
  SUPER_ADMIN_ROLE_CODE: 'super_admin',
}));
vi.mock('./user-role-select.vue', () => ({
  default: defineComponent({
    props: { value: { type: Array<number>, required: true } },
    emits: ['update:value'],
    setup:
      (props, { emit }) =>
      () =>
        h('div', [
          h('button', { onClick: () => emit('update:value', []) }, 'Clear'),
          h(
            'button',
            { onClick: () => emit('update:value', props.value.toReversed()) },
            'Reorder',
          ),
        ]),
  }),
}));

interface ModalHooks {
  onBeforeClose: () => Promise<boolean>;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => Promise<void>;
}

let app: App;
let container: HTMLDivElement;
let hooks: ModalHooks;
let record: UserApi.UserItem;
const modalApi = {
  close: vi.fn(),
  getData: () => ({ id: record.id, onSuccess: mocks.onSuccess }),
  lock: vi.fn(),
  setState: vi.fn(),
  unlock: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  record = {
    id: 42,
    username: 'reader',
    nickname: 'Reader',
    email: '',
    phone: '',
    remark: '',
    status: 1,
    createdAt: '',
    updatedAt: '',
    lastLoginAt: '',
    roles: [
      { id: 2, code: 'reader', name: 'Reader', status: 1 },
      { id: 3, code: 'editor', name: 'Editor', status: 1 },
    ],
  };
  mocks.get.mockImplementation(async () => record);
  mocks.save.mockResolvedValue(undefined);
  mocks.warning.mockImplementation((options: { onNegativeClick: () => void }) =>
    options.onNegativeClick(),
  );
  mocks.useModal.mockImplementation((options: ModalHooks) => {
    hooks = options;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      ),
      modalApi,
    ];
  });
  container = document.createElement('div');
  app = createApp(UserRolesModal);
  app.mount(container);
});

afterEach(() => {
  app.unmount();
  container.remove();
});

async function select(action: string) {
  await nextTick();
  const button = [...container.querySelectorAll('button')].find(
    (item) => item.textContent === action,
  );
  if (!button) throw new Error(`Button not found: ${action}`);
  button.click();
  await nextTick();
}

describe('user roles modal submission', () => {
  it.each([{ empty: false }, { empty: true }])(
    'submits unchanged roles, including empty selection: $empty',
    async ({ empty }) => {
      if (empty) record.roles = [];
      await hooks.onOpenChange(true);
      await hooks.onConfirm();

      expect(mocks.save).toHaveBeenCalledExactlyOnceWith(
        42,
        empty ? [] : [2, 3],
      );
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
        'common.saveSuccess',
      );
      expect(mocks.onSuccess).toHaveBeenCalledOnce();
      expect(modalApi.close).toHaveBeenCalledOnce();
      expect(await hooks.onBeforeClose()).toBe(true);
      expect(mocks.warning).not.toHaveBeenCalled();
      expect(mocks.logout).not.toHaveBeenCalled();
    },
  );

  it.each([
    { selection: 'unchanged', roleIds: [2, 3], logoutCalls: [], refreshes: 1 },
    { selection: 'reordered', roleIds: [3, 2], logoutCalls: [], refreshes: 1 },
    {
      selection: 'cleared',
      roleIds: [],
      logoutCalls: [[false, false]],
      refreshes: 0,
    },
  ])(
    'always submits own roles but only logs out for a changed set: $selection',
    async ({ selection, roleIds, logoutCalls, refreshes }) => {
      record.id = 1;
      await hooks.onOpenChange(true);
      if (selection === 'reordered') await select('Reorder');
      if (selection === 'cleared') await select('Clear');
      await hooks.onConfirm();

      expect(mocks.save).toHaveBeenCalledExactlyOnceWith(1, roleIds);
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
        'common.saveSuccess',
      );
      expect(mocks.logout.mock.calls).toEqual(logoutCalls);
      expect(mocks.onSuccess).toHaveBeenCalledTimes(refreshes);
    },
  );

  it('does not submit on close and still warns about unsaved changes', async () => {
    await hooks.onOpenChange(true);
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
    await select('Clear');
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(mocks.warning).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('keeps the submission guard and allows retry after failure', async () => {
    await hooks.onOpenChange(true);
    let reject!: (reason: Error) => void;
    mocks.save.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const pending = hooks.onConfirm();
    await hooks.onConfirm();
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(42, [2, 3]);
    expect(await hooks.onBeforeClose()).toBe(false);
    reject(new Error('offline'));
    await expect(pending).rejects.toThrow('offline');
    expect(modalApi.unlock).toHaveBeenCalledOnce();
    expect(modalApi.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.onSuccess).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();

    await hooks.onConfirm();
    expect(mocks.save).toHaveBeenCalledTimes(2);
    expect(modalApi.close).toHaveBeenCalledOnce();
  });

  it('does not submit before initialization or after loading fails', async () => {
    await hooks.onConfirm();
    mocks.get.mockRejectedValue(new Error('offline'));
    await hooks.onOpenChange(true);
    await hooks.onConfirm();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

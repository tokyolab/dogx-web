import type { App } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserPasswordModal from './user-password-modal.vue';

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  resetPassword: vi.fn(),
  success: vi.fn(),
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
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ logout: mocks.logout }),
}));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: mocks.success },
}));
vi.mock('#/api/system', () => ({ resetUserPasswordApi: mocks.resetPassword }));

interface ModalHooks {
  onBeforeClose: () => Promise<boolean>;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => Promise<void>;
}
interface DiscardDialog {
  onClose: () => void;
  onNegativeClick: () => void;
  onPositiveClick: () => void;
}

let app: App;
let container: HTMLDivElement;
let hooks: ModalHooks;
let modalData: { id: number; nickname: string };
let open: boolean;
let schema: VbenFormSchema[];
let values: { password?: string };
const formApi = {
  getValues: vi.fn(async () => ({ ...values })),
  resetForm: vi.fn(async () => {
    values = {};
  }),
  setValues: vi.fn(async (input: typeof values) => {
    values = { ...input };
  }),
  validate: vi.fn(async () => ({ valid: true })),
};
const modalApi = {
  // Vben's programmatic close also goes through onBeforeClose.
  close: vi.fn(async () => {
    if (await hooks.onBeforeClose()) open = false;
  }),
  getData: () => modalData,
  lock: vi.fn(),
  setState: vi.fn(),
  unlock: vi.fn(),
};

beforeEach(async () => {
  vi.clearAllMocks();
  values = {};
  open = true;
  modalData = { id: 42, nickname: 'Reader' };
  formApi.validate.mockResolvedValue({ valid: true });
  mocks.resetPassword.mockResolvedValue(undefined);
  mocks.warning.mockImplementation((options: DiscardDialog) =>
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
      modalApi,
    ];
  });
  container = document.createElement('div');
  app = createApp(UserPasswordModal);
  app.mount(container);
  await hooks.onOpenChange(true);
});

afterEach(() => {
  app.unmount();
  container.remove();
});

it('applies the same password policy and input limits when resetting a password', () => {
  const field = schema.find((item) => item.fieldName === 'password');
  expect(field?.component).toBe('NewPasswordInput');
  expect(field?.componentProps).toMatchObject({
    placeholder: 'page.system.user.newPasswordPlaceholder',
  });
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

describe('reset password unsaved changes', () => {
  it.each(['', undefined])(
    'closes without warning for an empty value (%s)',
    async (password) => {
      values.password = password;
      await modalApi.close();
      expect(open).toBe(false);
      expect(mocks.warning).not.toHaveBeenCalled();
      expect(mocks.resetPassword).not.toHaveBeenCalled();
    },
  );

  it.each(['onNegativeClick', 'onClose'] as const)(
    'keeps the input when the discard dialog is dismissed through %s',
    async (action) => {
      values.password = 'A';
      mocks.warning.mockImplementation((options: DiscardDialog) =>
        options[action](),
      );
      await modalApi.close();
      expect(open).toBe(true);
      expect(values.password).toBe('A');
      expect(mocks.warning).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          content: 'page.system.user.passwordDiscardContent',
          maskClosable: false,
          negativeText: 'common.cancel',
          positiveText: 'page.system.role.discardChanges',
          title: 'page.system.role.discardChangesTitle',
        }),
      );
      expect(mocks.resetPassword).not.toHaveBeenCalled();
    },
  );

  it('closes after confirming discard without resetting the password', async () => {
    values.password = 'Abcd123!';
    mocks.warning.mockImplementation((options: DiscardDialog) =>
      options.onPositiveClick(),
    );
    await modalApi.close();
    expect(open).toBe(false);
    expect(mocks.warning).toHaveBeenCalledOnce();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('routes the cancel button through the same close guard', async () => {
    values.password = 'Abcd123!';
    hooks.onCancel();
    await vi.waitFor(() => expect(mocks.warning).toHaveBeenCalledOnce());
    expect(modalApi.close).toHaveBeenCalledOnce();
    expect(open).toBe(true);
  });

  it('closes without warning after the entered password is cleared', async () => {
    values.password = 'Abcd123!';
    expect(await hooks.onBeforeClose()).toBe(false);
    values.password = '';
    mocks.warning.mockClear();
    await modalApi.close();
    expect(open).toBe(false);
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it('blocks closing and duplicate submission while the reset is pending', async () => {
    let finishReset!: () => void;
    mocks.resetPassword.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishReset = resolve;
      }),
    );
    values.password = 'Abcd123!';
    const pending = hooks.onConfirm();
    await vi.waitFor(() => expect(mocks.resetPassword).toHaveBeenCalledOnce());
    await modalApi.close();
    await hooks.onConfirm();
    expect(open).toBe(true);
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.resetPassword).toHaveBeenCalledOnce();
    finishReset();
    await pending;
    expect(open).toBe(false);
    expect(modalApi.unlock).toHaveBeenCalledOnce();
    expect(mocks.warning).not.toHaveBeenCalled();
  });

  it.each([
    { id: 1, logoutCalls: [[false, false]] },
    { id: 42, logoutCalls: [] },
  ])(
    'closes after a successful reset for user $id without a discard warning',
    async ({ id, logoutCalls }) => {
      modalData.id = id;
      values.password = 'Abcd123!';
      await hooks.onConfirm();
      expect(mocks.resetPassword).toHaveBeenCalledExactlyOnceWith(
        id,
        'Abcd123!',
      );
      expect(open).toBe(false);
      expect(mocks.warning).not.toHaveBeenCalled();
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
        'common.passwordResetSuccess',
      );
      expect(mocks.logout.mock.calls).toEqual(logoutCalls);
    },
  );

  it('keeps the close warning and entered password after a reset failure', async () => {
    const error = new Error('reset failed');
    mocks.resetPassword.mockRejectedValueOnce(error);
    values.password = 'Abcd123!';
    await expect(hooks.onConfirm()).rejects.toBe(error);
    expect(modalApi.unlock).toHaveBeenCalledOnce();
    expect(modalApi.close).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    await modalApi.close();
    expect(open).toBe(true);
    expect(values.password).toBe('Abcd123!');
    expect(mocks.warning).toHaveBeenCalledOnce();
  });

  it('keeps the close warning when validation fails before submission', async () => {
    formApi.validate.mockResolvedValueOnce({ valid: false });
    values.password = 'A';
    await hooks.onConfirm();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
    expect(modalApi.unlock).toHaveBeenCalledOnce();
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(values.password).toBe('A');
  });

  it('clears the saved state and input when reopening the modal', async () => {
    values.password = 'Abcd123!';
    await hooks.onConfirm();
    await hooks.onOpenChange(false);
    expect(values.password).toBeUndefined();
    await hooks.onOpenChange(true);
    expect(values.password).toBe('');
    expect(await hooks.onBeforeClose()).toBe(true);
    values.password = 'X';
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(mocks.warning).toHaveBeenCalledOnce();
  });
});

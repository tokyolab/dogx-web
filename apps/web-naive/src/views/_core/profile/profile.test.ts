import type { App, Component } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import BaseSetting from './base-setting.vue';
import PasswordSetting from './password-setting.vue';

const mocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
  success: vi.fn(),
  setUserInfo: vi.fn(),
  useForm: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({
    userInfo: { userId: '42', realName: 'Before' },
    setUserInfo: mocks.setUserInfo,
  }),
}));
vi.mock('#/store', () => ({ useAuthStore: () => ({ logout: mocks.logout }) }));
vi.mock('#/adapter/naive', () => ({ message: { success: mocks.success } }));
vi.mock('#/api/core/user', () => ({
  getProfileApi: mocks.getProfile,
  updateProfileApi: mocks.updateProfile,
}));
vi.mock('#/api/core/auth', () => ({ changePasswordApi: mocks.changePassword }));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z, useVbenForm: mocks.useForm };
});
vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue');
  const wrapper = defineComponent(
    (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  );
  return {
    NSpin: wrapper,
    NTag: wrapper,
    NButton: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      setup(props, { slots, attrs }) {
        return () =>
          h(
            'button',
            { ...attrs, disabled: props.disabled },
            slots.default?.(),
          );
      },
    }),
  };
});

let app: App | undefined;
let container: HTMLDivElement;
let schema: VbenFormSchema[];
let values: Record<string, unknown>;
const formApi = {
  validate: vi.fn(async () => ({ valid: true })),
  getValues: vi.fn(async () => ({ ...values })),
  setValues: vi.fn(async (input: Record<string, unknown>) => {
    values = { ...input };
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  values = {};
  formApi.validate.mockResolvedValue({ valid: true });
  mocks.getProfile.mockResolvedValue({
    username: 'alice',
    nickname: 'Alice',
    email: '',
    phone: '',
    departmentName: 'Sales',
    roles: ['Reader'],
  });
  mocks.updateProfile.mockResolvedValue(undefined);
  mocks.changePassword.mockResolvedValue(undefined);
  mocks.useForm.mockImplementation((options: { schema: VbenFormSchema[] }) => {
    schema = options.schema;
    return [
      defineComponent(
        (_, { slots }) =>
          () =>
            h('div', slots.roles?.()),
      ),
      formApi,
    ];
  });
  container = document.createElement('div');
});
afterEach(() => {
  app?.unmount();
  container.remove();
});
async function mount(component: Component) {
  app = createApp(component);
  app.config.errorHandler = mocks.error;
  app.mount(container);
  await nextTick();
}
function submit() {
  const button = container.querySelector('button');
  if (!button) throw new Error('Submit button was not rendered');
  button.click();
}

describe('personal profile', () => {
  it('loads real roles, keeps organization readonly, and submits unchanged profiles', async () => {
    await mount(BaseSetting);
    await vi.waitFor(() => expect(container.textContent).toContain('Reader'));
    for (const field of ['username', 'departmentName']) {
      expect(
        schema.find((item) => item.fieldName === field)?.componentProps,
      ).toMatchObject({ disabled: true });
    }
    submit();
    await vi.waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith('common.saveSuccess'),
    );
    expect(mocks.updateProfile).toHaveBeenCalledOnce();
    expect(mocks.setUserInfo).toHaveBeenCalledWith({
      userId: '42',
      realName: 'Alice',
    });
  });
  it('does not permit saving after load failure and supports retry', async () => {
    mocks.getProfile.mockRejectedValueOnce(new Error('unavailable'));
    await mount(BaseSetting);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('profile.retry'),
    );
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    submit();
    await vi.waitFor(() => expect(container.textContent).toContain('Reader'));
    expect(mocks.getProfile).toHaveBeenCalledTimes(2);
  });
  it('does not change displayed identity on failed save and permits retry', async () => {
    mocks.updateProfile.mockRejectedValueOnce(new Error('email conflict'));
    await mount(BaseSetting);
    await vi.waitFor(() => expect(container.textContent).toContain('Reader'));
    submit();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.setUserInfo).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    submit();
    await vi.waitFor(() => expect(mocks.success).toHaveBeenCalledOnce());
  });
  it('validates nickname and optional contacts', async () => {
    await mount(BaseSetting);
    const rules = (name: string) =>
      schema.find((item) => item.fieldName === name)?.rules as {
        safeParse: (input: string) => { success: boolean };
      };
    expect(rules('nickname').safeParse('  ').success).toBe(false);
    expect(rules('nickname').safeParse('中'.repeat(64)).success).toBe(true);
    expect(rules('nickname').safeParse('中'.repeat(65)).success).toBe(false);
    expect(rules('email').safeParse('').success).toBe(true);
    expect(rules('email').safeParse('invalid').success).toBe(false);
    expect(rules('phone').safeParse('1'.repeat(33)).success).toBe(false);
  });
});

describe('change own password', () => {
  it.each([undefined, null, ''])(
    'uses the localized required message for empty confirmation (%s)',
    async (value) => {
      await mount(PasswordSetting);
      const confirmation = schema.find(
        (item) => item.fieldName === 'confirmPassword',
      )?.dependencies?.rules as unknown as (values: Record<string, string>) => {
        safeParse: (input: unknown) => {
          error?: { issues: { message: string }[] };
          success: boolean;
        };
      };
      const result = confirmation({ newPassword: 'Abcd123!' }).safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'profile.confirmPasswordPlaceholder',
      );
      expect(mocks.changePassword).not.toHaveBeenCalled();
    },
  );
  it('uses the existing password policy and checks confirmation', async () => {
    await mount(PasswordSetting);
    const field = schema.find((item) => item.fieldName === 'newPassword');
    expect(field?.component).toBe('NewPasswordInput');
    const rules = field?.rules as {
      safeParse: (value: string) => { success: boolean };
    };
    expect(rules.safeParse('Abcd123!').success).toBe(true);
    for (const value of ['short', 'Abcd123?', 'Abcd 123!', '中文Abcd123!'])
      expect(rules.safeParse(value).success).toBe(false);
    const confirmation = schema.find(
      (item) => item.fieldName === 'confirmPassword',
    )?.dependencies?.rules as unknown as (
      values: Record<string, string>,
    ) => typeof rules;
    expect(
      confirmation({ newPassword: 'Abcd123!' }).safeParse('wrong').success,
    ).toBe(false);
    expect(
      confirmation({ newPassword: 'Abcd123!' }).safeParse('Abcd123!').success,
    ).toBe(true);
  });
  it('logs out locally only after a successful change', async () => {
    await mount(PasswordSetting);
    values = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass123!',
      confirmPassword: 'NewPass123!',
    };
    submit();
    await vi.waitFor(() =>
      expect(mocks.logout).toHaveBeenCalledExactlyOnceWith(false, false),
    );
    expect(mocks.changePassword).toHaveBeenCalledExactlyOnceWith(
      'OldPass123!',
      'NewPass123!',
    );
    expect(mocks.success).toHaveBeenCalledWith('common.saveSuccess');
  });
  it('keeps the session and allows retry on failure', async () => {
    await mount(PasswordSetting);
    mocks.changePassword.mockRejectedValueOnce(
      new Error('wrong current password'),
    );
    submit();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.logout).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    submit();
    await vi.waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });
  it('does not submit invalid form values', async () => {
    await mount(PasswordSetting);
    formApi.validate.mockResolvedValueOnce({ valid: false });
    submit();
    await nextTick();
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(mocks.logout).not.toHaveBeenCalled();
  });
  it('blocks duplicate saves while the request is pending', async () => {
    let finish!: () => void;
    mocks.changePassword.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await mount(PasswordSetting);
    submit();
    await vi.waitFor(() => expect(mocks.changePassword).toHaveBeenCalledOnce());
    submit();
    await nextTick();
    expect(mocks.changePassword).toHaveBeenCalledOnce();
    expect(mocks.logout).not.toHaveBeenCalled();
    finish();
    await vi.waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });
});

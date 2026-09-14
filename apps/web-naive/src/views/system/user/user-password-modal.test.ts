import type { VbenFormSchema } from '#/adapter/form';

import { createApp, defineComponent, h } from 'vue';

import { expect, it, vi } from 'vitest';

import UserPasswordModal from './user-password-modal.vue';

const mocks = vi.hoisted(() => ({ useForm: vi.fn() }));

vi.mock('@vben/common-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/common-ui')>()),
  useVbenModal: () => [
    defineComponent(
      (_, { slots }) =>
        () =>
          h('div', slots.default?.()),
    ),
    {},
  ],
}));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { useVbenForm: mocks.useForm, z };
});
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/stores', () => ({ useUserStore: () => ({}) }));
vi.mock('#/store', () => ({ useAuthStore: () => ({}) }));
vi.mock('#/adapter/naive', () => ({ message: { success: vi.fn() } }));
vi.mock('#/api/system', () => ({ resetUserPasswordApi: vi.fn() }));

it('applies the same password policy and input limits when resetting a password', () => {
  mocks.useForm.mockReturnValue([() => h('div'), {}]);
  const container = document.createElement('div');
  const app = createApp(UserPasswordModal);
  app.mount(container);
  try {
    const options = mocks.useForm.mock.calls[0]?.[0] as
      | undefined
      | {
          schema: VbenFormSchema[];
        };
    const field = options?.schema.find((item) => item.fieldName === 'password');
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
  } finally {
    app.unmount();
  }
});

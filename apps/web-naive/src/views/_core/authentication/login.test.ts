import type { App, PropType } from 'vue';

import type { VbenFormSchema } from '@vben/common-ui';

import { createApp, defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Login from './login.vue';

const mocks = vi.hoisted(() => ({
  authLogin: vi.fn(),
  schema: vi.fn(),
}));

vi.mock('@vben/common-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/common-ui')>()),
  AuthenticationLogin: defineComponent({
    props: {
      formSchema: { type: Array as PropType<VbenFormSchema[]>, required: true },
    },
    emits: ['submit'],
    setup(props, { emit }) {
      mocks.schema(props.formSchema);
      return () =>
        h('button', {
          onClick: () =>
            emit('submit', {
              password: 'Valid-pass123',
              username: 'DogX-Admin',
            }),
        });
    },
  }),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ authLogin: mocks.authLogin, loginLoading: false }),
}));

let app: App;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement('div');
  app = createApp(Login);
  app.mount(container);
});

afterEach(() => {
  app.unmount();
  container.remove();
});

describe('login username policy', () => {
  it('accepts uppercase and the 64-character boundary without normalization', () => {
    const schema = mocks.schema.mock.lastCall?.[0] as VbenFormSchema[];
    const field = schema.find((item) => item.fieldName === 'username');
    expect(field?.componentProps).toMatchObject({
      title: 'page.auth.usernameRules',
    });
    const rules = field?.rules as {
      safeParse: (value: string) => { data?: string; success: boolean };
    };
    for (const username of [
      'A',
      '123456',
      'DogX-Admin',
      'a-b-c',
      'A'.repeat(64),
    ]) {
      expect(rules.safeParse(username)).toMatchObject({
        data: username,
        success: true,
      });
    }
    for (const username of [
      '',
      '-admin',
      'admin-',
      'ad--min',
      'admin_01',
      'admin.01',
      '管理员',
      ' admin ',
      'admin\n',
      'a'.repeat(65),
    ]) {
      expect(rules.safeParse(username).success).toBe(false);
    }
  });

  it('submits the original username and password', () => {
    container.querySelector('button')?.click();
    expect(mocks.authLogin).toHaveBeenCalledExactlyOnceWith({
      password: 'Valid-pass123',
      username: 'DogX-Admin',
    });
  });
});

import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginProtection from './login-protection.vue';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
  success: vi.fn(),
  form: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/api/system/security', () => ({
  getLoginSecurityApi: mocks.get,
  updateLoginSecurityApi: mocks.update,
}));
vi.mock('#/adapter/naive', () => ({ message: { success: mocks.success } }));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z, useVbenForm: mocks.form };
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
    NDivider: wrapper,
    NButton: defineComponent({
      props: { disabled: Boolean, loading: Boolean },
      setup:
        (props, { attrs, slots }) =>
        () =>
          h(
            'button',
            { ...attrs, disabled: props.disabled },
            slots.default?.(),
          ),
    }),
  };
});

const config = {
  rateLimitEnabled: false,
  rateLimitWindowSeconds: 60,
  rateLimitMaxRequests: 30,
  failureLockEnabled: false,
  failureWindowSeconds: 900,
  failureThreshold: 5,
  lockDurationSeconds: 900,
};
let app: App;
let container: HTMLDivElement;
let forms: ReturnType<typeof createForm>[];
function getForm(index: number) {
  const form = forms[index];
  if (!form) throw new Error(`Form ${index} was not initialized`);
  return form;
}
function createForm() {
  let values: Record<string, unknown> = {};
  return {
    validate: vi.fn(async () => ({ valid: true })),
    getValues: vi.fn(async () => ({ ...values })),
    setValues: vi.fn(async (input: Record<string, unknown>) => {
      values = { ...input };
    }),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  forms = [];
  mocks.get.mockResolvedValue({ ...config });
  mocks.update.mockResolvedValue(undefined);
  mocks.form.mockImplementation(() => {
    const api = createForm();
    forms.push(api);
    return [defineComponent(() => () => h('div')), api];
  });
  container = document.createElement('div');
});
afterEach(() => {
  app?.unmount();
  container.remove();
});
async function mount() {
  app = createApp(LoginProtection);
  app.config.errorHandler = mocks.error;
  app.mount(container);
  await nextTick();
  await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledOnce());
  await nextTick();
}
function click() {
  const button = container.querySelector('button');
  if (!button) throw new Error('No action');
  button.click();
}

describe('login protection settings', () => {
  it('keeps inline lockout fields accessible and preserves integer bounds', async () => {
    await mount();
    const call = mocks.form.mock.calls[1];
    if (!call) throw new Error('Lockout form was not initialized');
    const options = call[0];
    expect(options.wrapperClass).toContain('flex-row');
    expect(options.wrapperClass).toContain('flex-wrap');
    expect(options.schema[0].formItemClass).toBe('w-full');
    const fields = options.schema.slice(1);
    expect(
      fields.map((field: { fieldName: string }) => field.fieldName),
    ).toEqual([
      'failureWindowSeconds',
      'failureThreshold',
      'lockDurationSeconds',
    ]);
    for (const field of fields) {
      expect(field.hideLabel).toBe(true);
      expect(field.componentProps.showButton).toBe(false);
      expect(field.componentProps.inputProps['aria-label']).toBe(field.label);
      expect(field.suffix).toMatch(/^security\..+Suffix$/);
      const { min, max } = field.componentProps;
      expect(field.rules.safeParse(min).success).toBe(true);
      expect(field.rules.safeParse(max).success).toBe(true);
      for (const invalid of [null, min - 1, max + 1, min + 0.5]) {
        expect(field.rules.safeParse(invalid).success).toBe(false);
      }
    }
  });
  it('submits independent lockout durations in seconds without conversion', async () => {
    await mount();
    const lockSettings = {
      failureLockEnabled: true,
      failureWindowSeconds: 120,
      failureThreshold: 7,
      lockDurationSeconds: 1800,
    };
    await getForm(1).setValues(lockSettings);
    click();
    await vi.waitFor(() =>
      expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
        ...config,
        ...lockSettings,
      }),
    );
  });
  it('submits unchanged full category and preserves false switches', async () => {
    await mount();
    click();
    await vi.waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith('common.saveSuccess'),
    );
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(config);
  });
  it('does not save defaults after failed load and supports retry', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    await mount();
    expect(container.textContent).toContain('security.retry');
    click();
    await vi.waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(2));
    expect(mocks.update).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(container.querySelector('button')?.disabled).toBe(false),
    );
    click();
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  });
  it('validates both sections and rejects invalid values', async () => {
    await mount();
    getForm(1).validate.mockResolvedValue({ valid: false });
    click();
    await vi.waitFor(() => expect(getForm(1).validate).toHaveBeenCalledOnce());
    expect(getForm(0).validate).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('guards duplicate clicks before validation completes', async () => {
    await mount();
    let finish!: (value: { valid: boolean }) => void;
    getForm(0).validate.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    click();
    click();
    expect(getForm(0).validate).toHaveBeenCalledOnce();
    finish({ valid: true });
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  });
  it('keeps input after save failure and allows retry', async () => {
    mocks.update.mockRejectedValueOnce(new Error('offline'));
    await mount();
    click();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
    click();
    await vi.waitFor(() => expect(mocks.success).toHaveBeenCalledOnce());
    expect(mocks.update).toHaveBeenLastCalledWith(config);
  });
});

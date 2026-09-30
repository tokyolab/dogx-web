/* eslint-disable vue/one-component-per-file -- Component stubs share this test harness. */
import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

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
    NSwitch: defineComponent({
      props: { value: Boolean },
      emits: ['update:value'],
      setup:
        (props, { attrs, emit }) =>
        () =>
          h('button', {
            ...attrs,
            role: 'switch',
            'aria-checked': props.value,
            onClick: () => emit('update:value', !props.value),
          }),
    }),
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
  const values = ref<Record<string, unknown>>({});
  return {
    values,
    validate: vi.fn(async () => ({ valid: true })),
    getValues: vi.fn(async () => ({ ...values.value })),
    setValues: vi.fn(async (input: Record<string, unknown>) => {
      values.value = { ...input };
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
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h(
              'div',
              Object.entries(slots).map(([name, slot]) =>
                slot?.({
                  value: api.values.value[name],
                  'onUpdate:value': (value: boolean) => {
                    api.values.value[name] = value;
                  },
                }),
              ),
            ),
      }),
      api,
    ];
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
  const button = container.querySelector<HTMLButtonElement>(
    'button:not([role="switch"])',
  );
  if (!button) throw new Error('No action');
  button.click();
}

describe('login protection settings', () => {
  it('groups each form before its helper text without the footer notice', async () => {
    await mount();
    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(2);
    expect(
      [...sections].map((section) => section.lastElementChild?.textContent),
    ).toEqual(['security.rateHelp', 'security.failureHelp']);
    for (const section of sections) {
      expect(section.firstElementChild?.querySelector('h3')).not.toBeNull();
      expect(section.lastElementChild?.tagName).toBe('P');
    }
    expect(container.textContent).not.toContain('security.applyHelp');
  });
  it('places accessible switches beside headings and submits their changes', async () => {
    await mount();
    expect(
      [...container.querySelectorAll('h3')].map((el) => el.textContent),
    ).toEqual(['security.rateLimit', 'security.failureLock']);
    const switches =
      container.querySelectorAll<HTMLButtonElement>('[role="switch"]');
    expect(switches).toHaveLength(2);
    for (const control of switches) {
      expect(control.parentElement?.querySelector('h3')).not.toBeNull();
      expect(control.getAttribute('aria-checked')).toBe('false');
      expect(control.getAttribute('aria-label')).toMatch(
        /^security\..+Enabled$/,
      );
      control.click();
    }
    await nextTick();
    for (const control of switches) {
      expect(control.getAttribute('aria-checked')).toBe('true');
    }
    for (const call of mocks.form.mock.calls) {
      expect(call[0].schema[0].hideLabel).toBe(true);
    }
    click();
    await vi.waitFor(() =>
      expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
        ...config,
        rateLimitEnabled: true,
        failureLockEnabled: true,
      }),
    );
  });
  it('keeps inline rate fields accessible and preserves integer bounds', async () => {
    await mount();
    const call = mocks.form.mock.calls[0];
    if (!call) throw new Error('Rate form was not initialized');
    const options = call[0];
    expect(options.wrapperClass).toContain('flex-row');
    expect(options.wrapperClass).toContain('flex-wrap');
    expect(options.schema[0].formItemClass).toBe('w-full');
    const fields = options.schema.slice(1);
    expect(
      fields.map((field: { fieldName: string }) => field.fieldName),
    ).toEqual(['rateLimitWindowSeconds', 'rateLimitMaxRequests']);
    expect(fields.map((field: { suffix: string }) => field.suffix)).toEqual([
      'security.rateWindowSuffix',
      'security.rateMaximumSuffix',
    ]);
    for (const field of fields) {
      expect(field.hideLabel).toBe(true);
      expect(field.formItemClass).not.toContain('grid-rows');
      expect(field.formItemClass).toContain(']:static');
      expect(field.formItemClass).not.toContain('contain:inline-size');
      expect(field.componentProps.showButton).toBe(false);
      expect(field.componentProps.inputProps['aria-label']).toBe(field.label);
      const { min, max } = field.componentProps;
      expect(field.rules.safeParse(min).success).toBe(true);
      expect(field.rules.safeParse(max).success).toBe(true);
      for (const invalid of [null, min - 1, max + 1, min + 0.5]) {
        expect(field.rules.safeParse(invalid).success).toBe(false);
      }
    }
  });
  it('submits inline rate settings in seconds without conversion', async () => {
    await mount();
    const rateSettings = {
      rateLimitEnabled: true,
      rateLimitWindowSeconds: 120,
      rateLimitMaxRequests: 50,
    };
    await getForm(0).setValues(rateSettings);
    click();
    await vi.waitFor(() =>
      expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
        ...config,
        ...rateSettings,
      }),
    );
  });
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
      expect(field.formItemClass).not.toContain('grid-rows');
      expect(field.formItemClass).toContain(']:static');
      expect(field.formItemClass).not.toContain('contain:inline-size');
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
      expect(
        container.querySelector<HTMLButtonElement>(
          'button:not([role="switch"])',
        )?.disabled,
      ).toBe(false),
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

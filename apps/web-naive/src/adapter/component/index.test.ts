import type { App, Component } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { globalShareState } from '@vben/common-ui';

import { darkTheme, lightTheme, NConfigProvider } from 'naive-ui';
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { initComponentAdapter } from './index';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/naive', () => ({ message: { success: vi.fn() } }));

let app: App | undefined;
let container: HTMLDivElement | undefined;

beforeEach(async () => {
  await initComponentAdapter();
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  container?.remove();
  container = undefined;
});

async function mountRadioGroup({
  disabled = false,
  disabledOption = false,
  isButton = true,
  theme = 'light',
}: {
  disabled?: boolean;
  disabledOption?: boolean;
  isButton?: boolean;
  theme?: 'dark' | 'light';
} = {}) {
  const RadioGroup = globalShareState.getComponents().RadioGroup as Component;
  const value = ref(1);
  const onUpdate = vi.fn((next: number) => {
    value.value = next;
  });
  const element = document.createElement('div');
  container = element;
  document.body.append(element);
  app = createApp({
    render: () =>
      h(
        NConfigProvider,
        { theme: theme === 'dark' ? darkTheme : lightTheme },
        () =>
          h(RadioGroup, {
            disabled,
            isButton,
            options: [
              { label: 'Enabled', value: 1 },
              { disabled: disabledOption, label: 'Disabled', value: 0 },
            ],
            value: value.value,
            'onUpdate:value': onUpdate,
          }),
      ),
  });
  app.mount(element);
  await vi.waitFor(() => {
    expect(element.querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });
  const inputs = [...element.querySelectorAll<HTMLInputElement>('input')];
  const second = inputs[1];
  assert(second);
  return { element, inputs, onUpdate, second, value };
}

describe('naive UI radio adapter', () => {
  it.each(['light', 'dark'] as const)(
    'preserves native button-group layout and selection in the %s theme',
    async (theme) => {
      const { element, inputs, onUpdate, second, value } =
        await mountRadioGroup({
          theme,
        });
      expect(
        element.querySelector('.n-radio-group--button-group'),
      ).not.toBeNull();
      expect(element.querySelectorAll('.n-radio-group__splitor')).toHaveLength(
        1,
      );
      expect(element.querySelectorAll('.n-radio-button')).toHaveLength(2);
      expect(inputs.map((input) => input.checked)).toEqual([true, false]);

      second.click();
      await nextTick();
      expect(onUpdate).toHaveBeenCalledExactlyOnceWith(0);
      expect(value.value).toBe(0);
      expect(inputs.map((input) => input.checked)).toEqual([false, true]);
    },
  );

  it('keeps a disabled button group non-interactive', async () => {
    const { inputs, onUpdate, second, value } = await mountRadioGroup({
      disabled: true,
    });
    expect(inputs.every((input) => input.disabled)).toBe(true);
    second.click();
    await nextTick();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(value.value).toBe(1);
  });

  it('preserves per-option disabling', async () => {
    const { inputs, onUpdate, second, value } = await mountRadioGroup({
      disabledOption: true,
    });
    expect(inputs.map((input) => input.disabled)).toEqual([false, true]);
    second.click();
    await nextTick();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(value.value).toBe(1);
  });

  it('leaves ordinary async radios unchanged', async () => {
    const { element, inputs, onUpdate, second } = await mountRadioGroup({
      isButton: false,
    });
    expect(element.querySelector('.n-radio-group--button-group')).toBeNull();
    expect(element.querySelectorAll('.n-radio')).toHaveLength(2);
    second.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith(0);
    expect(inputs.map((input) => input.checked)).toEqual([false, true]);
  });
});

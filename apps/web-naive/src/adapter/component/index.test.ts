import type { App, Component, VNode } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { globalShareState } from '@vben/common-ui';
import { addIcon } from '@vben/icons';

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
// Use the same NInput through Naive UI's Node-compatible entry in Vitest.
vi.mock('naive-ui/es/input', async () => {
  const { NInput } = await import('naive-ui');
  return { NInput };
});

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

function mountAdapter(render: () => VNode) {
  const element = document.createElement('div');
  container = element;
  document.body.append(element);
  app = createApp({ render });
  app.mount(element);
  return element;
}

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
  const element = mountAdapter(() =>
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
  );
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

describe('naive UI icon picker adapter', () => {
  it('filters icons through NInput and sends the selected icon back to the form', async () => {
    addIcon('dogx-picker:first', { body: '<path d="M1 1h2" />' });
    addIcon('dogx-picker:second', { body: '<circle cx="2" cy="2" r="1" />' });
    const IconPicker = globalShareState.getComponents().IconPicker as Component;
    const value = ref('dogx-picker:first');
    const onUpdate = vi.fn((next: string) => {
      value.value = next;
    });
    const element = mountAdapter(() =>
      h(NConfigProvider, null, () =>
        h(IconPicker, {
          modelValue: value.value,
          prefix: 'dogx-picker',
          value: value.value,
          'onUpdate:value': onUpdate,
        }),
      ),
    );
    await vi.waitFor(() => {
      expect(element.querySelector('input')?.value).toBe('dogx-picker:first');
    });

    const trigger = element.querySelector<HTMLButtonElement>(
      'button[aria-haspopup="dialog"]',
    );
    assert(trigger);
    trigger.click();
    const getPopover = () =>
      document.querySelector('[data-reka-popper-content-wrapper]');
    await vi.waitFor(() => {
      expect(getPopover()?.querySelectorAll('button')).toHaveLength(2);
    });
    const search = getPopover()?.querySelector<HTMLInputElement>('input');
    assert(search);
    search.value = 'second';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => {
      expect(getPopover()?.querySelectorAll('button')).toHaveLength(1);
    });
    expect(value.value).toBe('dogx-picker:first');

    const choice = getPopover()?.querySelector<HTMLButtonElement>('button');
    assert(choice);
    choice.click();
    await nextTick();
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('dogx-picker:second');
    expect(value.value).toBe('dogx-picker:second');
    expect(element.querySelector('input')?.value).toBe('dogx-picker:second');
  });
});

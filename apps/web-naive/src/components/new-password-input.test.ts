import type { App } from 'vue';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import NewPasswordInput from './new-password-input.vue';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

let app: App | undefined;
let container: HTMLDivElement;
const value = ref<null | string>('');

async function flush() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  await nextTick();
}

function mount(disabled = false) {
  vi.useFakeTimers();
  value.value = '';
  container = document.createElement('div');
  document.body.append(container);
  const onBlur = vi.fn();
  const onFocus = vi.fn();
  app = createApp({
    render: () =>
      h(NewPasswordInput, {
        disabled,
        id: 'test-password',
        placeholder: 'Enter a test password',
        value: value.value,
        'onUpdate:value': (password: null | string) => {
          value.value = password;
        },
        onBlur,
        onFocus,
      }),
  });
  app.mount(container);
  const input = container.querySelector('input');
  assert(input);
  return { input, onBlur, onFocus };
}

function checklist() {
  return [...document.querySelectorAll<HTMLElement>('[data-password-rule]')];
}

function passedRules() {
  return checklist()
    .filter((rule) => rule.textContent?.includes('page.auth.passwordRules.met'))
    .map((rule) => rule.dataset.passwordRule);
}

afterEach(async () => {
  app?.unmount();
  app = undefined;
  await flush();
  container.remove();
  vi.useRealTimers();
});

describe('new password guidance', () => {
  it('opens on focus and closes on blur while forwarding form events', async () => {
    const { input, onBlur, onFocus } = mount();
    expect(input.type).toBe('password');
    expect(input.maxLength).toBe(32);
    expect(input.autocomplete).toBe('new-password');
    expect(input.placeholder).toBe('Enter a test password');
    expect(checklist()).toHaveLength(0);
    input.focus();
    await flush();
    expect(onFocus).toHaveBeenCalledOnce();
    expect(checklist()).toHaveLength(3);
    expect(passedRules()).toEqual([]);
    input.blur();
    await flush();
    expect(onBlur).toHaveBeenCalledOnce();
    expect(checklist()).toHaveLength(0);
  });

  it('updates every rule while typing and resets when the form clears its value', async () => {
    const { input } = mount();
    input.focus();
    await flush();
    for (const [password, expected] of [
      ['Ab1', ['categories', 'characters']],
      ['Abcd1234', ['length', 'categories', 'characters']],
      ['abcdefgh', ['length', 'characters']],
    ] as const) {
      input.value = password;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      expect(value.value).toBe(password);
      expect(passedRules()).toEqual(expected);
    }
    value.value = null;
    await flush();
    expect(input.value).toBe('');
    expect(passedRules()).toEqual([]);
  });

  it('rejects unsupported input without silently stripping or changing the password', async () => {
    const { input } = mount();
    value.value = 'Abcd123!';
    await flush();
    for (const invalid of ['Abcd123! ', 'Abcd123!密', 'Abcd123!?']) {
      input.value = invalid;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
      expect(value.value).toBe('Abcd123!');
      expect(input.value).toBe('Abcd123!');
    }
  });

  it('does not allow typing or open guidance when disabled', async () => {
    const { input } = mount(true);
    expect(input.disabled).toBe(true);
    input.focus();
    await flush();
    expect(checklist()).toHaveLength(0);
  });
});

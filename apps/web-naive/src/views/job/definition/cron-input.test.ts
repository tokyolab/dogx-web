import type { App } from 'vue';

import { createApp, defineComponent, h, nextTick } from 'vue';

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { initSetupVbenForm, useVbenForm } from '#/adapter/form';

import { jobFormSchema } from './job-form';

const mocks = vi.hoisted(() => ({ preview: vi.fn() }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/api/job/definition', () => ({ previewJobCronApi: mocks.preview }));
vi.mock('../group/group-select.vue', () => ({ default: {} }));

let app: App;
let container: HTMLDivElement;
let formApi: ReturnType<typeof useVbenForm>[1];

beforeAll(async () => {
  await initSetupVbenForm();
});
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.preview.mockResolvedValue({ times: [] });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(
    defineComponent({
      setup() {
        const [Form, api] = useVbenForm({
          schema: jobFormSchema().filter(
            (field) => field.fieldName === 'cronExpr',
          ),
          showDefaultActions: false,
        });
        formApi = api;
        return () => h(Form);
      },
    }),
  );
  app.mount(container);
  await formApi.setValues({ cronExpr: '' });
  await nextTick();
});
afterEach(() => {
  app.unmount();
  container.remove();
});

async function enter(value: string) {
  const input = container.querySelector('input');
  if (!input) throw new Error('Cron input was not rendered');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  return input;
}

describe('cron input with the real Vben form and Naive input', () => {
  it('does not show a required error when initialized', () => {
    expect(container.textContent).not.toContain('ui.formRules.required');
    expect(container.querySelector('button')?.disabled).toBe(true);
  });

  it('saves typed input in the form and enables preview with the same expression', async () => {
    await enter('0 */5 * * * *');
    await vi.waitFor(async () => {
      const values = await formApi.getValues();
      expect(values.cronExpr).toBe('0 */5 * * * *');
      expect(container.querySelector('button')?.disabled).toBe(false);
    });
    const validation = await formApi.validate();
    expect(validation.valid).toBe(true);
    const button = container.querySelector('button');
    if (!button) throw new Error('Cron preview button was not rendered');
    button.click();
    await vi.waitFor(() =>
      expect(mocks.preview).toHaveBeenCalledExactlyOnceWith('0 */5 * * * *'),
    );
  });

  it('displays saved values when opening an edit form', async () => {
    await formApi.setValues({ cronExpr: '0 0 2 * * *' });
    await vi.waitFor(() =>
      expect(container.querySelector('input')?.value).toBe('0 0 2 * * *'),
    );
    expect(container.querySelector('button')?.disabled).toBe(false);
  });

  it('validates the nested input on blur and clears its previous value', async () => {
    const input = await enter('');
    input.dispatchEvent(new FocusEvent('blur'));
    await vi.waitFor(() =>
      expect(container.textContent).toContain('ui.formRules.required'),
    );
    await enter('0 * * * * *');
    await vi.waitFor(async () => {
      const values = await formApi.getValues();
      expect(values.cronExpr).toBe('0 * * * * *');
    });
    await enter('');
    await vi.waitFor(async () => {
      const values = await formApi.getValues();
      expect(values.cronExpr).toBe('');
    });
    expect(container.querySelector('button')?.disabled).toBe(true);
  });
});

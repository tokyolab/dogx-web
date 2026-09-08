import type { App } from 'vue';

import type { UserApi } from '#/api/system';

import { createApp, h, nextTick } from 'vue';

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { listUserRoleOptionsApi } from '#/api/system';

import UserRoleSelect from './user-role-select.vue';

vi.mock('#/api/system', () => ({ listUserRoleOptionsApi: vi.fn() }));
vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('naive-ui', () => ({
  NSelect: (props: {
    loading: boolean;
    onScroll: (event: Event) => void;
    onSearch: (keyword: string) => void;
    options: { label: string; value: number }[];
  }) =>
    h(
      'div',
      {
        'data-loading': props.loading,
        onScroll: props.onScroll,
      },
      [
        h('input', {
          onInput: (event: Event) =>
            props.onSearch((event.target as HTMLInputElement).value),
        }),
        ...props.options.map((option) =>
          h('span', { key: option.value }, option.label),
        ),
      ],
    ),
}));

const listOptions = vi.mocked(listUserRoleOptionsApi);
const role = (id: number): UserApi.UserRole => ({
  code: `role_${id}`,
  id,
  name: `Role ${id}`,
  status: 1,
});
let app: App | undefined;
let container: HTMLDivElement;

async function flush() {
  await Promise.resolve();
  await nextTick();
}

function mount(assigned: UserApi.UserRole[] = []) {
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(UserRoleSelect, {
    assigned,
    value: assigned.map((item) => item.id),
  });
  app.mount(container);
}

function search(keyword: string) {
  const input = container.querySelector('input');
  assert(input);
  input.value = keyword;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function control() {
  const element = container.firstElementChild;
  assert(element instanceof HTMLElement);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  listOptions.mockReset();
});

afterEach(() => {
  app?.unmount();
  app = undefined;
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('user role selection requests', () => {
  it('loads additional pages once and stops when all options are loaded', async () => {
    listOptions.mockResolvedValueOnce({ items: [role(1)], total: 2 });
    listOptions.mockResolvedValueOnce({ items: [role(2)], total: 2 });
    mount();
    await flush();
    control().dispatchEvent(new Event('scroll'));
    control().dispatchEvent(new Event('scroll'));
    await flush();
    expect(listOptions).toHaveBeenCalledTimes(2);
    expect(listOptions).toHaveBeenLastCalledWith({
      keyword: '',
      page: 2,
      pageSize: 200,
    });
    expect(container.textContent).toContain('Role 1');
    expect(container.textContent).toContain('Role 2');
    control().dispatchEvent(new Event('scroll'));
    expect(listOptions).toHaveBeenCalledTimes(2);
  });

  it('ignores stale search results and blocks paging while a new search is pending', async () => {
    type Result = { items: UserApi.UserRole[]; total: number };
    let resolve: ((result: Result) => void) | undefined;
    listOptions.mockReturnValueOnce(
      new Promise<Result>((complete) => {
        resolve = complete;
      }),
    );
    listOptions.mockResolvedValueOnce({ items: [role(2)], total: 1 });
    mount();
    search('reader');
    assert(resolve);
    resolve({ items: [role(1)], total: 5 });
    await flush();
    control().dispatchEvent(new Event('scroll'));
    expect(listOptions).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(listOptions).toHaveBeenLastCalledWith({
      keyword: 'reader',
      page: 1,
      pageSize: 200,
    });
    expect(container.textContent).not.toContain('Role 1');
    expect(container.textContent).toContain('Role 2');
  });

  it('does not start a debounced request after the modal unmounts', async () => {
    listOptions.mockResolvedValue({ items: [], total: 0 });
    mount();
    await flush();
    search('reader');
    assert(app);
    app.unmount();
    app = undefined;
    await vi.advanceTimersByTimeAsync(250);
    expect(listOptions).toHaveBeenCalledTimes(1);
  });

  it('retains assigned roles after a failure and allows another search', async () => {
    listOptions.mockRejectedValueOnce(new Error('network unavailable'));
    listOptions.mockResolvedValueOnce({ items: [role(3)], total: 1 });
    mount([{ ...role(2), status: 0 }]);
    await flush();
    expect(container.textContent).toContain('Role 2 (common.disabled)');
    expect(control().dataset.loading).toBe('false');
    search('new');
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(container.textContent).toContain('Role 2');
    expect(container.textContent).toContain('Role 3');
  });
});

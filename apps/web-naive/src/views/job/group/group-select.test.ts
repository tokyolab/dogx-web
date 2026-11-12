import type { App } from 'vue';

import type { ExecutorGroupApi } from '#/api/job/group';

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

import { listExecutorGroupsApi } from '#/api/job/group';

import GroupSelect from './group-select.vue';

vi.mock('#/api/job/group', () => ({ listExecutorGroupsApi: vi.fn() }));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('naive-ui', () => ({
  NSelect: (props: {
    loading: boolean;
    onScroll: (event: Event) => void;
    onSearch: (keyword: string) => void;
    options: { label: string; value: number }[];
  }) =>
    h('div', { 'data-loading': props.loading, onScroll: props.onScroll }, [
      h('input', {
        onInput: (event: Event) =>
          props.onSearch((event.target as HTMLInputElement).value),
      }),
      ...props.options.map((option) =>
        h('span', { key: option.value }, option.label),
      ),
    ]),
}));

const list = vi.mocked(listExecutorGroupsApi);
const item = (id: number): ExecutorGroupApi.Item => ({
  id,
  name: `Group ${id}`,
  discoveryKey: `test.group.${id}`,
  createdAt: '',
  updatedAt: '',
});
let app: App | undefined;
let container: HTMLDivElement;
async function flush() {
  await Promise.resolve();
  await nextTick();
}
function mount(assigned?: { id: number; name: string }) {
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(GroupSelect, { assigned, value: assigned?.id });
  app.mount(container);
}
function control() {
  const element = container.firstElementChild;
  assert(element instanceof HTMLElement);
  return element;
}
function search(keyword: string) {
  const input = container.querySelector('input');
  assert(input);
  input.value = keyword;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
beforeEach(() => {
  vi.useFakeTimers();
  list.mockReset();
});
afterEach(() => {
  app?.unmount();
  app = undefined;
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('executor group selection', () => {
  it('loads subsequent pages without duplicate scroll requests or a fixed first-page limit', async () => {
    list.mockResolvedValueOnce({ items: [item(1)], total: 2 });
    list.mockResolvedValueOnce({ items: [item(2)], total: 2 });
    mount();
    await flush();
    control().dispatchEvent(new Event('scroll'));
    control().dispatchEvent(new Event('scroll'));
    await flush();
    expect(list).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenLastCalledWith({ name: '', page: 2, pageSize: 50 });
    expect(container.textContent).toContain('Group 1');
    expect(container.textContent).toContain('Group 2');
    control().dispatchEvent(new Event('scroll'));
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('ignores responses from the previous search before debounce completes', async () => {
    let finish!: (result: ExecutorGroupApi.Result) => void;
    list.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    list.mockResolvedValueOnce({ items: [item(2)], total: 1 });
    mount();
    search('new');
    finish({ items: [item(1)], total: 100 });
    await flush();
    control().dispatchEvent(new Event('scroll'));
    expect(list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(list).toHaveBeenLastCalledWith({
      name: 'new',
      page: 1,
      pageSize: 50,
    });
    expect(container.textContent).not.toContain('Group 1');
    expect(container.textContent).toContain('Group 2');
  });

  it('retains the assigned group after a failed search without paging the old results', async () => {
    list.mockResolvedValueOnce({ items: [item(1)], total: 100 });
    list.mockRejectedValueOnce(new Error('network unavailable'));
    list.mockResolvedValueOnce({ items: [item(3)], total: 1 });
    mount({ id: 9, name: 'Assigned group' });
    await flush();
    search('failed');
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    control().dispatchEvent(new Event('scroll'));
    expect(list).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Assigned group');
    expect(container.textContent).not.toContain('Group 1');
    search('available');
    await vi.advanceTimersByTimeAsync(250);
    await flush();
    expect(container.textContent).toContain('Assigned group');
    expect(container.textContent).toContain('Group 3');
  });

  it('does not send a queued search after unmounting', async () => {
    list.mockResolvedValue({ items: [], total: 0 });
    mount();
    await flush();
    search('new');
    app?.unmount();
    app = undefined;
    await vi.advanceTimersByTimeAsync(250);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

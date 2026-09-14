import type { App } from 'vue';

import type { UserApi } from '#/api/system';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import UserRoleTags from './user-role-tags.vue';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

const roles = ref<UserApi.UserRole[]>([]);
let app: App | undefined;
let container: HTMLDivElement;

function role(id: number, status = 1): UserApi.UserRole {
  return { code: `role_${id}`, id, name: `Role ${id}`, status };
}

async function flush() {
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  await nextTick();
}

function mount(assigned: UserApi.UserRole[]) {
  vi.useFakeTimers();
  roles.value = assigned;
  container = document.createElement('div');
  document.body.append(container);
  app = createApp({ render: () => h(UserRoleTags, { roles: roles.value }) });
  app.mount(container);
}

function cellTags() {
  return [...container.querySelectorAll<HTMLElement>('.n-tag')];
}

afterEach(async () => {
  app?.unmount();
  app = undefined;
  await flush();
  container.remove();
  vi.useRealTimers();
});

describe('user role tags', () => {
  it('leaves users without roles empty', () => {
    mount([]);
    expect(container.textContent).toBe('');
    expect(cellTags()).toHaveLength(0);
  });

  it('shows one role without a count and uses native ellipsis for long names', () => {
    const assigned = { ...role(1), name: '财务管理'.repeat(16) };
    mount([assigned]);
    expect(cellTags()).toHaveLength(1);
    expect(container.textContent?.trim()).toBe(assigned.name);
    expect(container.querySelector('.n-ellipsis')).not.toBeNull();
  });

  it('keeps only the first role and count in the cell, and shows every role on hover', async () => {
    const assigned = Array.from({ length: 10 }, (_, index) => role(index + 1));
    assigned[1] = role(2, 0);
    mount(assigned);
    expect(cellTags().map((tag) => tag.textContent?.trim())).toEqual([
      'Role 1',
      '+9',
    ]);
    expect(document.querySelector('ul')).toBeNull();

    const count = cellTags()[1];
    assert(count);
    count.dispatchEvent(new MouseEvent('mouseenter'));
    await flush();
    const list = document.querySelector('ul');
    assert(list);
    expect(
      [...list.querySelectorAll('li')].map((item) => item.textContent?.trim()),
    ).toEqual(
      assigned.map((item) =>
        item.status === 1 ? item.name : `${item.name} (common.disabled)`,
      ),
    );
    expect(list.classList.contains('overflow-y-auto')).toBe(true);
    expect(cellTags()).toHaveLength(2);

    count.dispatchEvent(new MouseEvent('mouseleave'));
    await flush();
    expect(document.querySelector('ul')).toBeNull();
  });

  it('updates the summary after assignments change and preserves disabled status', async () => {
    mount([role(1), role(2)]);
    roles.value = [role(3, 0)];
    await flush();
    expect(cellTags().map((tag) => tag.textContent?.trim())).toEqual([
      'Role 3 (common.disabled)',
    ]);
    roles.value = [];
    await flush();
    expect(container.textContent).toBe('');
  });
});

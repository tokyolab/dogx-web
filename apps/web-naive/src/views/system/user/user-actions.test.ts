import type { DialogOptions } from 'naive-ui';

import type { App } from 'vue';

import type { UserApi } from '#/api/system';

import { createApp, defineComponent, h, nextTick } from 'vue';

import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import UserList from './index.vue';

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  operatorID: 1,
  reload: vi.fn(),
  updateUserStatus: vi.fn(),
  useGrid: vi.fn(),
  useModal: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('@vben/common-ui', () => ({
  Page: defineComponent(
    (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  ),
  useVbenModal: mocks.useModal,
}));
vi.mock('@vben/icons', () => ({ ChevronDown: () => h('svg') }));
vi.mock('@vben/locales', () => {
  const messages: Record<string, string> = {
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'page.system.user.assignRoles': 'Assign Roles',
    'page.system.user.more': 'More',
    'page.system.user.resetPassword': 'Reset Password',
  };
  return { $t: (key: string) => messages[key] ?? key };
});
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: mocks.operatorID } }),
}));
vi.mock('@vben/utils', () => ({ formatDateTime: vi.fn() }));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: vi.fn() },
}));
vi.mock('#/adapter/vxe-table', () => ({ useVbenVxeGrid: mocks.useGrid }));
vi.mock('#/api/system', () => ({
  deleteUserApi: mocks.deleteUser,
  listUsersApi: vi.fn(),
  updateUserStatusApi: mocks.updateUserStatus,
}));
vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));
vi.mock('./user-form-modal.vue', () => ({ default: () => h('div') }));
vi.mock('./user-password-modal.vue', () => ({ default: () => h('div') }));
vi.mock('./user-roles-modal.vue', () => ({ default: () => h('div') }));

let app: App | undefined;
let container: HTMLDivElement;
let record: UserApi.UserItem;
const modalApis = Array.from({ length: 3 }, () => ({
  open: vi.fn(),
  setData: vi.fn().mockReturnThis(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.deleteUser.mockReset();
  mocks.operatorID = 1;
  record = {
    createdAt: '',
    email: '',
    id: 9,
    lastLoginAt: '',
    nickname: 'Reader',
    phone: '',
    remark: '',
    roles: [],
    status: 1,
    updatedAt: '',
    username: 'reader',
  };
  let modalIndex = 0;
  mocks.useModal.mockImplementation(() => [
    () => h('div'),
    modalApis[modalIndex++],
  ]);
  mocks.useGrid.mockImplementation(() => [
    defineComponent(
      (_, { slots }) =>
        () =>
          h('div', [
            slots.status?.({ row: record }),
            slots.operation?.({ row: record }),
          ]),
    ),
    { reload: mocks.reload },
  ]);
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(async () => {
  app?.unmount();
  app = undefined;
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  container.remove();
  vi.useRealTimers();
});

function mount() {
  app = createApp(UserList);
  app.mount(container);
}

function button(text: string) {
  const result = [...container.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === text,
  );
  assert(result);
  return result;
}

async function menuItem(text: string) {
  let result: HTMLElement | undefined;
  await vi.waitFor(() => {
    result = [
      ...document.querySelectorAll<HTMLElement>('.n-dropdown-option-body'),
    ].find((item) => item.textContent?.trim() === text);
    expect(result).toBeDefined();
  });
  assert(result);
  return result;
}

async function openMore() {
  button('More').click();
  await nextTick();
  return {
    delete: await menuItem('Delete'),
    resetPassword: await menuItem('Reset Password'),
  };
}

function statusSwitch() {
  const result = container.querySelector<HTMLElement>('[role="switch"]');
  assert(result);
  return result;
}

function buttonTrigger(text: string) {
  const result = button(text).parentElement;
  assert(result);
  return result;
}

async function checkTooltip(target: HTMLElement, expected?: string) {
  target.dispatchEvent(new MouseEvent('mouseenter'));
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  const tooltip = document.querySelector('.n-tooltip');
  expect(tooltip?.textContent?.trim()).toBe(expected);
  target.dispatchEvent(new MouseEvent('mouseleave'));
  await nextTick();
  await vi.advanceTimersByTimeAsync(350);
  expect(document.querySelector('.n-tooltip')).toBeNull();
}

async function checkDeleteTooltip(item: HTMLElement, expected?: string) {
  const trigger = item.closest<HTMLElement>('.n-dropdown-option');
  assert(trigger);
  await checkTooltip(trigger, expected);
}

describe('user list more actions', () => {
  it('keeps only edit, assign roles and more in the operation cell', async () => {
    mount();
    expect(
      [...container.querySelectorAll('button')].map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(['Edit', 'Assign Roles', 'More']);
    const menu = await openMore();
    menu.resetPassword.click();
    await nextTick();
    expect(modalApis[2]?.setData).toHaveBeenCalledWith({
      id: 9,
      nickname: 'Reader',
    });
    expect(modalApis[2]?.open).toHaveBeenCalledOnce();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('requires confirmation before deleting and blocks repeated confirmation', async () => {
    let finish: (() => void) | undefined;
    mocks.deleteUser.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    mount();
    const menu = await openMore();
    menu.delete.click();
    expect(mocks.warning).toHaveBeenCalledOnce();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    const confirmation = mocks.warning.mock.calls[0]?.[0] as DialogOptions;
    confirmation.onPositiveClick?.(new MouseEvent('click'));
    confirmation.onPositiveClick?.(new MouseEvent('click'));
    expect(mocks.deleteUser).toHaveBeenCalledExactlyOnceWith(9);
    await nextTick();
    expect(button('More').disabled).toBe(true);
    await checkTooltip(buttonTrigger('More'));
    assert(finish);
    finish();
    await vi.waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
    await nextTick();
    expect(button('More').disabled).toBe(false);
  });

  it('allows retry after deletion fails', async () => {
    let fail: ((error: Error) => void) | undefined;
    mocks.deleteUser.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    mount();
    const menu = await openMore();
    menu.delete.click();
    const confirmation = mocks.warning.mock.calls[0]?.[0] as DialogOptions;
    confirmation.onPositiveClick?.(new MouseEvent('click'));
    await nextTick();
    expect(button('More').disabled).toBe(true);
    assert(fail);
    fail(new Error('request failed'));
    await vi.waitFor(() => expect(button('More').disabled).toBe(false));
    expect(mocks.reload).not.toHaveBeenCalled();
    const retryMenu = await openMore();
    retryMenu.delete.click();
    expect(mocks.warning).toHaveBeenCalledTimes(2);
  });

  it('lets the super administrator reset its password but not assign roles or delete itself', async () => {
    record.roles = [
      { code: 'super_admin', id: 1, name: 'Super Admin', status: 1 },
    ];
    mocks.operatorID = record.id;
    mount();
    expect(button('Edit').disabled).toBe(false);
    expect(button('Assign Roles').disabled).toBe(true);
    await checkTooltip(statusSwitch(), 'page.system.user.superAdminStatusHelp');
    await checkTooltip(
      buttonTrigger('Assign Roles'),
      'page.system.user.superAdminRolesHelp',
    );
    statusSwitch().click();
    button('Assign Roles').click();
    expect(mocks.updateUserStatus).not.toHaveBeenCalled();
    expect(modalApis[1]?.open).not.toHaveBeenCalled();
    const menu = await openMore();
    await checkDeleteTooltip(
      menu.delete,
      'page.system.user.superAdminDeleteHelp',
    );
    menu.delete.click();
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    menu.resetPassword.click();
    expect(modalApis[2]?.open).toHaveBeenCalledOnce();
  });

  it('explains disabled management actions on another super administrator account', async () => {
    record.roles = [
      { code: 'super_admin', id: 1, name: 'Super Admin', status: 1 },
    ];
    mount();
    expect(button('Edit').disabled).toBe(true);
    expect(button('Assign Roles').disabled).toBe(true);
    expect(button('More').disabled).toBe(true);
    for (const text of ['Edit', 'More']) {
      await checkTooltip(
        buttonTrigger(text),
        'page.system.user.superAdminManageHelp',
      );
      button(text).click();
    }
    expect(modalApis[0]?.open).not.toHaveBeenCalled();
    expect(document.querySelector('.n-dropdown-menu')).toBeNull();
  });

  it('keeps a regular user protected against self-deletion', async () => {
    mocks.operatorID = record.id;
    mount();
    await checkTooltip(statusSwitch(), 'page.system.user.selfStatusHelp');
    statusSwitch().click();
    expect(mocks.updateUserStatus).not.toHaveBeenCalled();
    expect(button('Assign Roles').disabled).toBe(false);
    const menu = await openMore();
    await checkDeleteTooltip(menu.delete, 'page.system.user.selfDeleteHelp');
    menu.delete.click();
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it('does not show protection reasons for allowed actions on ordinary users', async () => {
    mount();
    await checkTooltip(statusSwitch());
    for (const text of ['Edit', 'Assign Roles', 'More']) {
      expect(button(text).disabled).toBe(false);
      await checkTooltip(buttonTrigger(text));
    }
    const menu = await openMore();
    await checkDeleteTooltip(menu.delete);
  });
});

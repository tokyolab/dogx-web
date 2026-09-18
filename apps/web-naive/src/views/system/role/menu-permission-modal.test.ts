import type { App } from 'vue';

import type { MenuApi, RoleApi } from '#/api/system';

import { createApp, defineComponent, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MenuPermissionModal from './menu-permission-modal.vue';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  modal: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/common-ui', () => ({ useVbenModal: mocks.modal }));
vi.mock('#/adapter/naive', () => ({
  dialog: { warning: mocks.warning },
  message: { success: mocks.success },
}));
vi.mock('#/api/system', () => ({
  getRoleMenusApi: mocks.get,
  updateRoleMenusApi: mocks.save,
  SUPER_ADMIN_ROLE_CODE: 'super_admin',
}));
interface Hooks {
  onOpenChange: (open: boolean) => Promise<void>;
  onConfirm: () => Promise<void>;
  onBeforeClose: () => Promise<boolean>;
}
let hooks: Hooks;
let app: App;
let container: HTMLDivElement;
let record: RoleApi.RoleItem;
const api = {
  getData: () => ({ record }),
  close: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  setState: vi.fn(),
};
const page: MenuApi.Item = {
  id: 1,
  parentId: 0,
  type: 2,
  name: 'Users',
  routeName: 'Users',
  path: '/users',
  component: 'system/user/index',
  permission: '',
  icon: '',
  sort: 0,
  visible: true,
  keepAlive: false,
  external: false,
  remark: '',
  status: 1,
  createdAt: '',
  updatedAt: '',
};
beforeEach(() => {
  vi.clearAllMocks();
  record = {
    id: 9,
    code: 'reader',
    name: 'Reader',
    status: 1,
    isSystem: false,
    sort: 0,
    description: '',
    createdAt: '',
    updatedAt: '',
  };
  mocks.get.mockResolvedValue({ items: [page], menuIds: [1] });
  mocks.save.mockResolvedValue({});
  mocks.modal.mockImplementation((options: Hooks) => {
    hooks = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      }),
      api,
    ];
  });
  container = document.createElement('div');
  document.body.append(container);
  app = createApp(MenuPermissionModal);
  app.mount(container);
});
afterEach(() => {
  app.unmount();
  container.remove();
});
async function clearSelection() {
  await nextTick();
  const button = [...container.querySelectorAll('button')].find((b) =>
    b.textContent.includes('clearMenus'),
  );
  if (!button) throw new Error('Clear button not found');
  button.click();
  await nextTick();
}
describe('menu permission modal', () => {
  it('does not warn or save when merely opened and closed', async () => {
    await hooks.onOpenChange(true);
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
  });
  it.each([{ menuIds: [1] }, { menuIds: [] }])(
    'submits unchanged grants on confirmation: $menuIds',
    async ({ menuIds }) => {
      mocks.get.mockResolvedValue({ items: [page], menuIds });
      await hooks.onOpenChange(true);
      await hooks.onConfirm();
      expect(mocks.save).toHaveBeenCalledExactlyOnceWith(9, menuIds);
      expect(mocks.success).toHaveBeenCalledExactlyOnceWith(
        'common.saveSuccess',
      );
      expect(api.lock).toHaveBeenCalledOnce();
      expect(api.unlock).toHaveBeenCalledOnce();
      expect(api.close).toHaveBeenCalledOnce();
      expect(await hooks.onBeforeClose()).toBe(true);
      expect(mocks.warning).not.toHaveBeenCalled();
    },
  );
  it('prevents saving while loading and after load failure', async () => {
    mocks.get.mockRejectedValue(new Error('offline'));
    await expect(hooks.onOpenChange(true)).rejects.toThrow('offline');
    await hooks.onConfirm();
    expect(mocks.save).not.toHaveBeenCalled();
    expect(api.setState).not.toHaveBeenCalledWith({ confirmDisabled: false });
  });
  it('guards repeated submissions and preserves unsaved changes on failure', async () => {
    await hooks.onOpenChange(true);
    await clearSelection();
    let reject!: (reason: Error) => void;
    mocks.save.mockReturnValue(
      new Promise((_, r) => {
        reject = r;
      }),
    );
    const save = hooks.onConfirm();
    await hooks.onConfirm();
    expect(mocks.save).toHaveBeenCalledExactlyOnceWith(9, []);
    expect(await hooks.onBeforeClose()).toBe(false);
    reject(new Error('offline'));
    await expect(save).rejects.toThrow('offline');
    mocks.warning.mockImplementation(
      (options: { onNegativeClick: () => void }) => options.onNegativeClick(),
    );
    expect(await hooks.onBeforeClose()).toBe(false);
    expect(api.close).not.toHaveBeenCalled();
  });
  it('rejects the super administrator and ignores a response received after closing', async () => {
    record.code = 'super_admin';
    await hooks.onOpenChange(true);
    expect(mocks.get).not.toHaveBeenCalled();
    record.code = 'reader';
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const opening = hooks.onOpenChange(true);
    await hooks.onOpenChange(false);
    resolve({ items: [page], menuIds: [1] });
    await opening;
    await hooks.onConfirm();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('saves an explicitly cleared set and closes without a discard warning', async () => {
    await hooks.onOpenChange(true);
    await clearSelection();
    await hooks.onConfirm();
    expect(mocks.save).toHaveBeenCalledWith(9, []);
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith('common.saveSuccess');
    expect(await hooks.onBeforeClose()).toBe(true);
    expect(api.close).toHaveBeenCalledOnce();
  });
});

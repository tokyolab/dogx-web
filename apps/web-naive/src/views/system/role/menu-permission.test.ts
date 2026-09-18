import type { MenuApi } from '#/api/system/menu';

import { createApp, h, nextTick, ref } from 'vue';

import { NTree } from 'naive-ui';
import { describe, expect, it } from 'vitest';

import {
  buildMenuPermissionTree,
  menuCheckState,
  menuGrantIDs,
  updateMenuGrants,
} from './menu-permission';
function item(id: number, parentId = 0): MenuApi.Item {
  return {
    id,
    parentId,
    type: parentId ? 2 : 1,
    name: `Node${id}`,
    routeName: '',
    path: '',
    component: '',
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
}
const items = [item(1), item(2, 1), item(3, 2), item(4, 2), item(5, 1)];
describe('explicit menu grants and native cascade', () => {
  it('saves checked nodes and ancestors without granting siblings or new descendants', () => {
    expect(menuGrantIDs(items, [3, 3])).toEqual([1, 2, 3]);
    const state = menuCheckState(buildMenuPermissionTree(items), [1, 2, 3]);
    expect(state.checked).toEqual([3]);
    expect(state.indeterminate).toEqual([2, 1]);
    expect(
      menuCheckState(buildMenuPermissionTree(items), [1, 2]).checked,
    ).toEqual([]);
  });
  it('preserves a formerly leaf page while editing unrelated branches, and allows replacing it', () => {
    const tree = buildMenuPermissionTree(items);
    expect(updateMenuGrants(items, tree, [1, 2], [5], 5)).toEqual([1, 2, 5]);
    expect(updateMenuGrants(items, tree, [1, 2], [], 1)).toEqual([]);
    expect(updateMenuGrants(items, tree, [1, 2], [3], 3)).toEqual([1, 2, 3]);
    expect(updateMenuGrants(items, tree, [1, 2, 3], [], 3)).toEqual([]);
  });
  it('uses real NTree cascade for select-all, partial page access, search and clearing', async () => {
    const grants = ref<number[]>([]);
    const keyword = ref('');
    const tree = buildMenuPermissionTree(items);
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp({
      setup: () => () => {
        const checks = menuCheckState(tree, grants.value);
        return h(NTree, {
          data: tree,
          cascade: true,
          checkable: true,
          checkOnClick: true,
          checkStrategy: 'child',
          defaultExpandAll: true,
          checkedKeys: checks.checked,
          indeterminateKeys: checks.indeterminate,
          pattern: keyword.value,
          showIrrelevantNodes: false,
          onUpdateCheckedKeys: (keys, _options, meta) => {
            grants.value = updateMenuGrants(
              items,
              tree,
              grants.value,
              keys,
              Number(meta.node?.key),
            );
          },
        });
      },
    });
    app.mount(container);
    try {
      const click = async (label: string) => {
        const node = [
          ...container.querySelectorAll('.n-tree-node-content'),
        ].find((n) => n.textContent === label);
        expect(node).toBeTruthy();
        (node as HTMLElement).click();
        await nextTick();
      };
      await click('Node1');
      expect(grants.value).toEqual([1, 2, 3, 4, 5]);
      await click('Node4');
      expect(grants.value).toEqual([1, 2, 3, 5]); // view node keeps its page half-selected
      keyword.value = 'Node5';
      await nextTick();
      await click('Node5');
      expect(grants.value).toEqual([1, 2, 3]); // filtering must not drop another branch
      keyword.value = '';
      await nextTick();
      await click('Node1'); // half-selected parent selects its current descendants
      expect(grants.value).toEqual([1, 2, 3, 4, 5]);
      await click('Node1');
      expect(grants.value).toEqual([]);
    } finally {
      app.unmount();
      container.remove();
    }
  });
});

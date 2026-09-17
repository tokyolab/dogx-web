import type { MenuApi } from '#/api/system/menu';

import { describe, expect, it } from 'vitest';

import {
  menuFormValues,
  menuPayload,
  menuSnapshot,
  newMenuValues,
  validMenuPath,
} from './menu-form';
import { filterMenuTree, menuParentOptions } from './menu-tree';

function item(
  id: number,
  parentId: number,
  name: string,
  type = 1,
  status = 1,
): MenuApi.Item {
  return {
    ...menuPayload(newMenuValues(parentId, type)),
    id,
    name,
    status,
    createdAt: '',
    updatedAt: '',
  };
}
const nodes = [
  item(1, 0, 'System'),
  item(2, 1, 'Users', 2, 0),
  item(3, 2, 'Create', 3),
  item(4, 0, 'Other'),
];
describe('menu tree', () => {
  it('keeps all ancestors of a name match without unrelated branches', () => {
    expect(filterMenuTree(nodes, ' create ').map((v) => v.id)).toEqual([
      1, 2, 3,
    ]);
  });
  it('keeps an enabled parent as context for a disabled match', () => {
    expect(filterMenuTree(nodes, '', 0).map((v) => v.id)).toEqual([1, 2]);
    expect(filterMenuTree(nodes, 'missing')).toEqual([]);
    expect(filterMenuTree(nodes).map((v) => v.id)).toEqual([1, 2, 3, 4]);
  });
  it('excludes self, descendants and elements from parent options', () => {
    expect(menuParentOptions(nodes, 'Root', 1)).toEqual([
      { key: 0, label: 'Root', children: [{ key: 4, label: 'Other' }] },
    ]);
    const options = JSON.stringify(menuParentOptions(nodes, 'Root'));
    expect(options).not.toContain('Create');
    expect(options).toContain('Users');
  });
  it('terminates when legacy data contains a cycle', () => {
    const cyclic = [item(1, 2, 'One'), item(2, 1, 'Two')];
    expect(filterMenuTree(cyclic, 'One')).toHaveLength(2);
    expect(menuParentOptions(cyclic, 'Root', 1)).toEqual([
      { key: 0, label: 'Root', children: [] },
    ]);
  });
});
describe('menu form payload', () => {
  it('clears route fields and flags on conversion to an element', () => {
    const values = {
      ...newMenuValues(2, 3),
      name: ' Create ',
      permission: ' user.create ',
      path: '/old',
      component: 'old/index',
      routeName: 'Old',
      icon: 'lucide:user',
      external: 1,
      keepAlive: 1,
    };
    expect(menuPayload(values)).toMatchObject({
      parentId: 2,
      name: 'Create',
      permission: 'user.create',
      path: '',
      component: '',
      routeName: '',
      icon: '',
      visible: false,
      external: false,
      keepAlive: false,
    });
  });
  it('clears incompatible fields on directory and external page conversions', () => {
    expect(
      menuPayload({
        ...newMenuValues(),
        component: 'old/index',
        permission: 'old',
        keepAlive: 1,
        external: 1,
      }),
    ).toMatchObject({
      component: '',
      permission: '',
      external: false,
      keepAlive: false,
    });
    expect(
      menuPayload({
        ...newMenuValues(0, 2),
        external: 1,
        component: 'old/index',
        keepAlive: 1,
      }),
    ).toMatchObject({ component: '', external: true, keepAlive: false });
  });
  it('preserves false, zero and empty values', () => {
    const values = newMenuValues(0, 2);
    values.visible = 0;
    expect(menuPayload(values)).toMatchObject({
      visible: false,
      sort: 0,
      parentId: 0,
      remark: '',
    });
  });
  it('excludes metadata and separately managed status from edit snapshots', () => {
    const row = item(2, 1, 'Users', 2, 0);
    const form = menuFormValues(row);
    expect(menuSnapshot(form, true)).toBe(
      menuSnapshot({ ...form, status: 1 }, true),
    );
    expect(menuSnapshot(form, false)).not.toBe(
      menuSnapshot({ ...form, status: 1 }, false),
    );
  });
  it.each(['/users', '/users/:id', '/用户'])(
    'accepts internal route %s',
    (path) => expect(validMenuPath(path, false)).toBe(true),
  );
  it.each([
    '//evil.test',
    'javascript:alert(1)',
    '/a?q=1',
    '/a#b',
    '/a b',
    String.raw`/a\b`,
  ])('rejects unsafe internal route %s', (path) =>
    expect(validMenuPath(path, false)).toBe(false),
  );
  it('only allows http(s) external links without credentials', () => {
    expect(validMenuPath('https://example.com?a=1#b', true)).toBe(true);
    expect(validMenuPath('javascript:alert(1)', true)).toBe(false);
    expect(validMenuPath('https://user:pass@example.com', true)).toBe(false);
  });
});

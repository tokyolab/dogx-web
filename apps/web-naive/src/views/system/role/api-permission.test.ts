import type { RoleApi } from '#/api/system';

import { describe, expect, it } from 'vitest';

import {
  buildAPIResourceTree,
  filterAPIResourceTreeBySelection,
  getRequiredAPIIDs,
  normalizeAPISelection,
} from './api-permission';

const resources: RoleApi.APIItem[] = [
  {
    group: '角色管理',
    id: 1,
    isRequired: true,
    method: 'POST',
    name: '角色列表',
    path: '/role/list',
    remark: '',
    serviceName: 'system-api',
    status: 1,
  },
  {
    group: '角色管理',
    id: 2,
    isRequired: false,
    method: 'POST',
    name: '新增角色',
    path: '/role/create',
    remark: '',
    serviceName: 'system-api',
    status: 1,
  },
  {
    group: '历史接口',
    id: 3,
    isRequired: false,
    method: 'POST',
    name: '停用接口',
    path: '/legacy',
    remark: '',
    serviceName: 'system-api',
    status: 0,
  },
];

describe('role API permission tree', () => {
  it('groups enabled APIs and locks required leaves', () => {
    const tree = buildAPIResourceTree(resources);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.label).toBe('system-api');
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children?.[0]?.children).toEqual([
      expect.objectContaining({ checkboxDisabled: true, key: 1 }),
      expect.objectContaining({ checkboxDisabled: false, key: 2 }),
    ]);
  });

  it('keeps required APIs and removes non-API tree keys', () => {
    expect(
      normalizeAPISelection(['service:system-api', 2, 2, -1], [1]),
    ).toEqual([1, 2]);
    expect(getRequiredAPIIDs(resources)).toEqual([1]);
  });

  it('keeps parent branches when showing selected APIs only', () => {
    const filtered = filterAPIResourceTreeBySelection(
      buildAPIResourceTree(resources),
      new Set([2]),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.children?.[0]?.children).toEqual([
      expect.objectContaining({ key: 2 }),
    ]);
  });
});

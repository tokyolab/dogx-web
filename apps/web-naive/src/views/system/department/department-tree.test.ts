import type { DepartmentApi } from '#/api/system/department';

import { describe, expect, it } from 'vitest';

import {
  departmentOptions,
  departmentParentOptions,
  filterDepartmentTree,
} from './department-tree';

const departments: DepartmentApi.Item[] = [
  {
    id: 1,
    parentId: 0,
    name: '总部',
    sort: 0,
    status: 1,
    remark: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    parentId: 1,
    name: '研发部',
    sort: 0,
    status: 1,
    remark: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    parentId: 2,
    name: '平台组',
    sort: 0,
    status: 1,
    remark: '',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 4,
    parentId: 0,
    name: '历史部门',
    sort: 1,
    status: 0,
    remark: '',
    createdAt: '',
    updatedAt: '',
  },
];

describe('department tree helpers', () => {
  it('keeps ancestors when filtering a descendant', () => {
    expect(
      filterDepartmentTree(departments, '平台组').map((item) => item.id),
    ).toEqual([1, 2, 3]);
    expect(
      filterDepartmentTree(departments, '', 0).map((item) => item.id),
    ).toEqual([4]);
  });

  it('excludes the edited department and its descendants from parent choices', () => {
    const options = departmentParentOptions(departments, 'Root', 2);
    expect(options[0]?.label).toBe('Root');
    expect(options[0]?.children?.map((item) => item.key)).toEqual([1, 4]);
  });

  it('disables inactive departments for new assignment but keeps the current one', () => {
    const options = departmentOptions(departments, 4, true);
    const inactive = options.find((item) => item.key === 4);
    expect(inactive?.disabled).toBe(false);
    const active = departmentOptions(departments, undefined, true).find(
      (item) => item.key === 4,
    );
    expect(active?.disabled).toBe(true);
  });
});

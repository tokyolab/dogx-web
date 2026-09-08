import type { UserApi } from '#/api/system';

import { describe, expect, it, vi } from 'vitest';

import {
  editableRoleIDs,
  mergeRoleOptions,
  normalizeUserProfile,
  userActionAvailability,
} from './user-form';

vi.mock('#/api/system/role', () => ({ SUPER_ADMIN_ROLE_CODE: 'super_admin' }));

const superRole: UserApi.UserRole = {
  code: 'super_admin',
  id: 1,
  name: 'Super Admin',
  status: 1,
};
const roles: UserApi.UserRole[] = [
  superRole,
  { code: 'reader', id: 2, name: 'Reader', status: 1 },
  { code: 'disabled', id: 3, name: 'Disabled', status: 0 },
];

describe('user management forms', () => {
  it('protects the initialized administrator regardless of ID or role status', () => {
    const user = { id: 42, roles: [superRole] };
    expect(userActionAvailability(user, 1)).toEqual({
      canAssignRoles: false,
      canDeactivate: false,
      canManage: false,
    });
    expect(userActionAvailability(user, 42)).toEqual({
      canAssignRoles: false,
      canDeactivate: false,
      canManage: true,
    });
    expect(
      userActionAvailability(
        { ...user, roles: [{ ...superRole, status: 0 }] },
        1,
      ),
    ).toEqual({
      canAssignRoles: false,
      canDeactivate: false,
      canManage: false,
    });
    expect(userActionAvailability({ ...user, roles }, 42)).toEqual({
      canAssignRoles: false,
      canDeactivate: false,
      canManage: true,
    });
  });

  it('allows ordinary user management but not self-deactivation', () => {
    const user = { id: 9, roles: [] };
    expect(userActionAvailability(user, 1)).toEqual({
      canAssignRoles: true,
      canDeactivate: true,
      canManage: true,
    });
    expect(userActionAvailability(user, 9)).toEqual({
      canAssignRoles: true,
      canDeactivate: false,
      canManage: true,
    });
  });

  it('never submits the protected super administrator role', () => {
    expect(editableRoleIDs(roles)).toEqual([2, 3]);
    expect(roles).toHaveLength(3);
  });

  it('retains assigned disabled roles and merges fresh options without duplicates', () => {
    const options = mergeRoleOptions(roles, [
      { code: 'reader', id: 2, name: 'Renamed Reader', status: 1 },
      { code: 'writer', id: 4, name: 'Writer', status: 1 },
      superRole,
    ]);
    expect(options.map((role) => role.id)).toEqual([2, 3, 4]);
    expect(options[0]?.name).toBe('Renamed Reader');
    expect(options[1]?.status).toBe(0);
  });

  it('sends explicit empty values when clearing optional profile fields', () => {
    expect(
      normalizeUserProfile({
        email: ' ',
        nickname: ' 昵称 ',
        phone: '',
        remark: ' ',
      }),
    ).toEqual({
      email: '',
      nickname: '昵称',
      phone: '',
      remark: '',
    });
  });

  it('keeps credential, status and role fields out of profile updates', () => {
    const values = {
      email: '',
      nickname: 'Alice',
      password: 'secret',
      phone: '',
      remark: '',
      roleIds: [1],
      status: 0,
      username: 'alice',
    };
    expect(normalizeUserProfile(values)).toEqual({
      email: '',
      nickname: 'Alice',
      phone: '',
      remark: '',
    });
    expect(values.password).toBe('secret');
  });
});

import type { UserApi } from '#/api/system';

import { SUPER_ADMIN_ROLE_CODE } from '#/api/system/role';

export function userActionAvailability(
  user: Pick<UserApi.UserItem, 'id' | 'roles'>,
  currentUserID: number,
) {
  const isSelf = user.id === currentUserID;
  const isSuper = user.roles.some(
    (role) => role.code === SUPER_ADMIN_ROLE_CODE,
  );
  return {
    canAssignRoles: !isSuper,
    canDeactivate: !isSelf && !isSuper,
    canManage: !isSuper || isSelf,
  };
}

export function editableRoleIDs(roles: UserApi.UserRole[]) {
  return roles
    .filter((role) => role.code !== SUPER_ADMIN_ROLE_CODE)
    .map((role) => role.id);
}

export function mergeRoleOptions(
  assigned: UserApi.UserRole[],
  available: UserApi.UserRole[],
) {
  const roles = new Map<number, UserApi.UserRole>();
  for (const role of [...assigned, ...available]) {
    if (role.code !== SUPER_ADMIN_ROLE_CODE) roles.set(role.id, role);
  }
  return [...roles.values()];
}

export function normalizeUserProfile(values: UserApi.Profile): UserApi.Profile {
  return {
    departmentId: values.departmentId ?? 0,
    email: values.email?.trim() ?? '',
    nickname: values.nickname?.trim() ?? '',
    phone: values.phone?.trim() ?? '',
    remark: values.remark?.trim() ?? '',
  };
}

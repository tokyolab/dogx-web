import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

interface CurrentUserResult {
  id: number;
  nickname: string;
  username: string;
}

function toUserInfo(currentUser: CurrentUserResult): UserInfo {
  return {
    avatar: '/avatar.svg',
    desc: '',
    homePath: '/analytics',
    realName: currentUser.nickname || currentUser.username,
    roles: [],
    token: '',
    userId: String(currentUser.id),
    username: currentUser.username,
  };
}

/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  const currentUser = await requestClient.post<CurrentUserResult>('/auth/me');
  return toUserInfo(currentUser);
}

export { toUserInfo };
export type { CurrentUserResult };

export interface ProfileUpdate {
  nickname: string;
  email: string;
  phone: string;
}

export interface PersonalProfile extends ProfileUpdate {
  username: string;
  departmentName: string;
  roles: string[];
}

export function getProfileApi() {
  return requestClient.post<PersonalProfile>('/auth/profile');
}

export function updateProfileApi(data: ProfileUpdate) {
  return requestClient.post('/auth/profile/update', {
    nickname: data.nickname.trim(),
    email: data.email?.trim() ?? '',
    phone: data.phone?.trim() ?? '',
  });
}

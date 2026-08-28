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

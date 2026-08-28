import { describe, expect, it } from 'vitest';

import { toUserInfo } from './user';

describe('toUserInfo', () => {
  it('maps the DogX current-user response to the Vben user contract', () => {
    expect(
      toUserInfo({ id: 42, nickname: 'Administrator', username: 'admin' }),
    ).toEqual({
      avatar: '/avatar.svg',
      desc: '',
      homePath: '/analytics',
      realName: 'Administrator',
      roles: [],
      token: '',
      userId: '42',
      username: 'admin',
    });
  });

  it('uses the username when the nickname is empty', () => {
    expect(
      toUserInfo({ id: 7, nickname: '', username: 'operator' }).realName,
    ).toBe('operator');
  });
});

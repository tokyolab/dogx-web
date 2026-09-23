import { beforeEach, expect, it, vi } from 'vitest';

import { changePasswordApi } from './auth';
import { getProfileApi, updateProfileApi } from './user';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({
  requestClient: { post: mocks.post },
  baseRequestClient: { post: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());

it('fetches own profile without accepting a target ID', async () => {
  const profile = { nickname: 'Alice', roles: ['Reader'] };
  mocks.post.mockResolvedValueOnce(profile);
  expect(await getProfileApi()).toBe(profile);
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/profile');
});
it('sends only editable fields, trimming contacts and nickname', async () => {
  const values = {
    nickname: ' Alice ',
    email: ' ',
    phone: ' 123 ',
    userId: 999,
    departmentId: 9,
    roles: ['admin'],
  };
  await updateProfileApi(values);
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/profile/update', {
    nickname: 'Alice',
    email: '',
    phone: '123',
  });
});
it('does not trim or transform password inputs', async () => {
  await changePasswordApi(' old ', 'NewPass123!');
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/change-password', {
    currentPassword: ' old ',
    newPassword: 'NewPass123!',
  });
});

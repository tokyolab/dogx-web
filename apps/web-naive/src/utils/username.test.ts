import { describe, expect, it } from 'vitest';

import { isValidUsername } from './username';

describe('username policy', () => {
  it.each([
    ['', false],
    ['A', true],
    ['0', true],
    ['DogX-Admin123', true],
    ['123456', true],
    ['a-b-c', true],
    ['A'.repeat(64), true],
    ['a'.repeat(65), false],
    ['-', false],
    ['-admin', false],
    ['admin-', false],
    ['ad--min', false],
    ['admin_01', false],
    ['admin.01', false],
    ['管理员', false],
    ['café', false],
    ['Ａdmin', false],
    ['a–b', false],
    ['admin😀', false],
    [' admin', false],
    ['admin ', false],
    ['ad min', false],
    ['ad\tmin', false],
    ['admin\n', false],
  ])('validates %j as %s', (username, valid) => {
    expect(isValidUsername(username)).toBe(valid);
  });
});

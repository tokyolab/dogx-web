import { describe, expect, it } from 'vitest';

import { isPasswordWithinByteLimit, isValidNewPassword } from './password';

describe('password boundaries', () => {
  it.each([
    ['empty', '', false],
    ['short ASCII', 'a'.repeat(11), false],
    ['minimum ASCII', 'a'.repeat(12), true],
    ['maximum ASCII', 'a'.repeat(72), true],
    ['overlong ASCII', 'a'.repeat(73), false],
    ['short Chinese', '密'.repeat(11), false],
    ['minimum Chinese', '密'.repeat(12), true],
    ['maximum Chinese', '密'.repeat(24), true],
    ['overlong Chinese', '密'.repeat(25), false],
    ['short emoji', '😀'.repeat(11), false],
    ['minimum emoji', '😀'.repeat(12), true],
    ['maximum emoji', '😀'.repeat(18), true],
    ['overlong emoji', '😀'.repeat(19), false],
    ['mixed boundary', `${'密'.repeat(23)}abc`, true],
    ['mixed overlong', `${'密'.repeat(23)}abcd`, false],
    ['leading and trailing spaces', ' pass word  ', true],
  ])('validates %s without changing the password', (_, password, valid) => {
    expect(isValidNewPassword(password)).toBe(valid);
  });

  it.each([
    ['short existing password', 'short', true],
    ['ASCII boundary', 'a'.repeat(72), true],
    ['ASCII overflow', 'a'.repeat(73), false],
    ['Chinese boundary', '密'.repeat(24), true],
    ['Chinese overflow', '密'.repeat(25), false],
    ['emoji boundary', '😀'.repeat(18), true],
    ['emoji overflow', '😀'.repeat(19), false],
  ])('checks the login byte limit for %s', (_, password, valid) => {
    expect(isPasswordWithinByteLimit(password)).toBe(valid);
  });
});

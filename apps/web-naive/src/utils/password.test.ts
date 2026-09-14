import { i18n } from '@vben/locales';

import { describe, expect, it } from 'vitest';

import enPage from '../locales/langs/en-US/page.json';
import zhPage from '../locales/langs/zh-CN/page.json';
import {
  getNewPasswordChecks,
  isAllowedPasswordInput,
  isPasswordWithinByteLimit,
  isValidNewPassword,
} from './password';

describe('password boundaries', () => {
  it.each([
    ['en-US', enPage],
    ['zh-CN', zhPage],
  ] as const)(
    'renders the special-character list literally in %s',
    (locale, page) => {
      i18n.global.setLocaleMessage(locale, {
        passwordPolicy: page.auth.passwordRules.characters,
      });
      expect(i18n.global.t('passwordPolicy', {}, { locale })).toContain(
        '!@#$%^&*()_+-=',
      );
    },
  );

  it.each([
    ['empty', '', false],
    ['too short', 'Abc123!', false],
    ['minimum', 'Abcd123!', true],
    ['maximum', `Aa1${'!'.repeat(29)}`, true],
    ['too long', `Aa1${'!'.repeat(30)}`, false],
    ['upper lower digit', 'Abcd1234', true],
    ['upper lower special', 'Abcdefg!', true],
    ['upper digit special', 'ABCD123!', true],
    ['lower digit special', 'abcd123!', true],
    ['one category', 'abcdefgh', false],
    ['two letter categories', 'Abcdefgh', false],
    ['lower digit only', 'abcd1234', false],
    ['upper digit only', 'ABCD1234', false],
    ['lower special only', 'abcdefg!', false],
    ['upper special only', 'ABCDEFG!', false],
    ['digit special only', '1234567!', false],
    ['space', 'Abc123! ', false],
    ['leading space', ' Abcd123!', false],
    ['tab', 'Abc123!\t', false],
    ['newline', 'Abc123!\n', false],
    ['Chinese', 'Abc123!密', false],
    ['emoji', 'Abc123!😀', false],
    ['full-width', 'Abc123!Ａ', false],
    ['unsupported punctuation', 'Abc123!?', false],
  ])('validates %s without changing the password', (_, password, valid) => {
    expect(isValidNewPassword(password)).toBe(valid);
    const checks = getNewPasswordChecks(password);
    expect(Object.values(checks).every(Boolean)).toBe(valid);
  });

  it('reports each rule independently, without marking empty input as satisfied', () => {
    expect(getNewPasswordChecks('')).toEqual({
      length: false,
      categories: false,
      characters: false,
    });
    expect(getNewPasswordChecks('Ab1')).toEqual({
      length: false,
      categories: true,
      characters: true,
    });
    expect(getNewPasswordChecks('abcdefgh')).toEqual({
      length: true,
      categories: false,
      characters: true,
    });
    expect(getNewPasswordChecks('Abcd123?')).toEqual({
      length: true,
      categories: true,
      characters: false,
    });
  });

  it('accepts only the specified ASCII characters, including while typing', () => {
    const allowed =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';
    expect(isAllowedPasswordInput('')).toBe(true);
    for (let code = 0; code < 128; code++) {
      const character = String.fromCodePoint(code);
      expect(isAllowedPasswordInput(character)).toBe(
        allowed.includes(character),
      );
      expect(isValidNewPassword(`Abcd123!${character}`)).toBe(
        allowed.includes(character),
      );
    }
    for (const character of ['密', '😀', 'Ａ', '１', '！']) {
      expect(isAllowedPasswordInput(character)).toBe(false);
    }
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

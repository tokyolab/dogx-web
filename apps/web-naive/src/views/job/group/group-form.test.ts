import { describe, expect, it, vi } from 'vitest';

import enGroup from '#/locales/langs/en-US/job-group.json';
import zhGroup from '#/locales/langs/zh-CN/job-group.json';

import { groupFormSchema } from './group-form';

const locale = vi.hoisted(() => ({ current: 'zh-CN' }));
vi.mock('@vben/locales', () => ({
  $t: (key: string) => {
    const dictionary = locale.current === 'zh-CN' ? zhGroup : enGroup;
    return (
      dictionary[key.replace('job-group.', '') as keyof typeof dictionary] ??
      key
    );
  },
}));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z };
});

function rule(field: string) {
  return groupFormSchema().find((item) => item.fieldName === field)?.rules as {
    isOptional: () => boolean;
    safeParse: (value: unknown) => {
      data?: string;
      error?: { issues: { message: string }[] };
      success: boolean;
    };
  };
}

describe.each(['zh-CN', 'en-US'])(
  'executor group validation in %s',
  (language) => {
    it.each([
      ['name', '', 'nameRequired'],
      ['name', null, 'nameRequired'],
      ['name', undefined, 'nameRequired'],
      ['name', 'a'.repeat(129), 'nameTooLong'],
      ['name', ' group', 'nameWhitespace'],
      ['name', 'group ', 'nameWhitespace'],
      ['name', '\tgroup\n', 'nameWhitespace'],
      ['name', ' ', 'nameWhitespace'],
      ['name', 'group\0name', 'nameInvalid'],
      ['discoveryKey', '', 'discoveryKeyRequired'],
      ['discoveryKey', null, 'discoveryKeyRequired'],
      ['discoveryKey', undefined, 'discoveryKeyRequired'],
      ['discoveryKey', 'a'.repeat(256), 'discoveryKeyTooLong'],
      ['discoveryKey', ' executor.key', 'discoveryKeyWhitespace'],
      ['discoveryKey', 'executor.key ', 'discoveryKeyWhitespace'],
      ['discoveryKey', '\u3000executor.key', 'discoveryKeyWhitespace'],
      ['discoveryKey', 'executor\0key', 'discoveryKeyInvalid'],
    ])('localizes %s validation for %s', (field, value, key) => {
      locale.current = language;
      const dictionary = language === 'zh-CN' ? zhGroup : enGroup;
      const result = rule(field as string).safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        dictionary[key as keyof typeof dictionary],
      );
    });

    it('keeps both identity fields required without changing valid input', () => {
      locale.current = language;
      for (const [field, value] of [
        ['name', 'Ops Team'],
        ['name', '中'.repeat(128)],
        ['discoveryKey', '/dogx/ExecutorA'],
        ['discoveryKey', 'a'.repeat(255)],
      ] as const) {
        const validation = rule(field);
        expect(validation.isOptional()).toBe(false);
        expect(validation.safeParse(value)).toEqual({
          success: true,
          data: value,
        });
      }
    });
  },
);

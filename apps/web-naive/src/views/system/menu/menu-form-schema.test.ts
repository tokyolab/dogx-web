import { describe, expect, it, vi } from 'vitest';

import { menuFormSchema } from './menu-form-schema';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z };
});

describe('menu field rules', () => {
  const schema = menuFormSchema([]);
  function rule(key: string, values: Record<string, unknown>) {
    const field = schema.find((v) => v.fieldName === key);
    if (!field) throw new Error(`Missing field: ${key}`);
    const rules = field.dependencies?.rules;
    return (
      typeof rules === 'function'
        ? rules(values, {} as never, {} as never)
        : field.rules
    ) as { safeParse: (value: unknown) => { success: boolean } };
  }
  it('requires a parent only for elements', () => {
    expect(rule('parentId', { type: 1 }).safeParse(0).success).toBe(true);
    expect(rule('parentId', { type: 3 }).safeParse(0).success).toBe(false);
  });
  it('requires components only for internal pages', () => {
    expect(
      rule('component', { type: 2, external: 0 }).safeParse('').success,
    ).toBe(false);
    expect(
      rule('component', { type: 2, external: 1 }).safeParse('').success,
    ).toBe(true);
    expect(rule('component', { type: 1 }).safeParse('').success).toBe(true);
  });
  it('validates route and permission fields according to type', () => {
    expect(rule('routeName', { type: 2 }).safeParse('1bad').success).toBe(
      false,
    );
    expect(rule('routeName', { type: 3 }).safeParse('').success).toBe(true);
    expect(
      rule('permission', { type: 3 }).safeParse('user.create').success,
    ).toBe(true);
    expect(
      rule('permission', { type: 3 }).safeParse('user create').success,
    ).toBe(false);
  });
  it('trims required names and rejects blank or oversized names', () => {
    expect(rule('name', {}).safeParse('  ').success).toBe(false);
    expect(rule('name', {}).safeParse('中文'.repeat(32)).success).toBe(true);
    expect(rule('name', {}).safeParse('中'.repeat(65)).success).toBe(false);
  });
  it('keeps remarks optional without a required marker', () => {
    expect(rule('remark', {}).safeParse(undefined).success).toBe(true);
    expect(rule('remark', {}).safeParse('').success).toBe(true);
    expect(rule('remark', {}).safeParse('中'.repeat(501)).success).toBe(false);
  });
  it('removes the status field on edit but keeps the type editable', () => {
    expect(menuFormSchema([], 1).some((v) => v.fieldName === 'status')).toBe(
      false,
    );
    expect(
      menuFormSchema([], 1).find((v) => v.fieldName === 'type')?.componentProps,
    ).not.toHaveProperty('disabled', true);
  });
});

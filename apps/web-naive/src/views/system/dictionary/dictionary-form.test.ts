import { describe, expect, it, vi } from 'vitest';

import { dictionaryFormSchema, dictionarySnapshot } from './dictionary-form';
vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/adapter/form', async () => {
  const { z } = await import('@vben/common-ui');
  return { z };
});
function valid(field: string, value: unknown, item = false) {
  const rule = dictionaryFormSchema(item, false).find(
    (v) => v.fieldName === field,
  )?.rules as { safeParse: (v: unknown) => { success: boolean } };
  return rule.safeParse(value).success;
}
describe('dictionary form contract', () => {
  it.each([
    ['name', '', false, 'nameRequired'],
    ['name', null, false, 'nameRequired'],
    ['name', 'a'.repeat(129), false, 'nameTooLong'],
    ['code', '', false, 'codeRequired'],
    ['code', undefined, false, 'codeRequired'],
    ['code', 'a'.repeat(65), false, 'codeTooLong'],
    ['code', 'Upper', false, 'codeRule'],
    ['label', ' ', true, 'labelRequired'],
    ['label', 'a'.repeat(129), true, 'labelTooLong'],
    ['value', '', true, 'valueRequired'],
    ['value', 'a'.repeat(129), true, 'valueTooLong'],
    ['remark', 'a'.repeat(501), true, 'remarkTooLong'],
    ['sort', null, true, 'sortRequired'],
    ['sort', undefined, true, 'sortRequired'],
    ['sort', -1, true, 'sortInvalid'],
    ['sort', 1.5, true, 'sortInvalid'],
    ['sort', 2_147_483_648, true, 'sortTooLarge'],
  ])(
    'uses a field-specific localized error for %s (%s)',
    (field, value, item, key) => {
      const rule = dictionaryFormSchema(Boolean(item), false).find(
        (v) => v.fieldName === field,
      )?.rules as {
        safeParse: (v: unknown) => {
          error?: { issues: { message: string }[] };
          success: boolean;
        };
      };
      const result = rule.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        `page.system.dictionary.${key}`,
      );
    },
  );
  it('explains sort order and keeps the public switch at its natural width', () => {
    expect(
      dictionaryFormSchema(true, false).find((v) => v.fieldName === 'sort')
        ?.help,
    ).toBe('page.system.dictionary.sortHelp');
    expect(
      dictionaryFormSchema(false, false).find((v) => v.fieldName === 'isPublic')
        ?.componentProps,
    ).toEqual({ class: 'w-auto' });
  });
  it.each([false, true])(
    'ignores only whitespace trimmed by submission (editing: %s)',
    (editing) => {
      expect(
        dictionarySnapshot(
          { name: ' 来源 ', remark: ' 备注 ', code: 'source' },
          false,
          editing,
        ),
      ).toBe(
        dictionarySnapshot(
          { name: '来源', remark: '备注', code: 'source' },
          false,
          editing,
        ),
      );
      expect(
        dictionarySnapshot(
          { label: ' 官网 ', value: ' web ', remark: ' 备注 ' },
          true,
          editing,
        ),
      ).toBe(
        dictionarySnapshot(
          { label: '官网', value: 'web', remark: '备注' },
          true,
          editing,
        ),
      );
      expect(dictionarySnapshot({ name: '来 源' }, false, editing)).not.toBe(
        dictionarySnapshot({ name: '来源' }, false, editing),
      );
      expect(
        dictionarySnapshot({ label: '另一个标签' }, true, editing),
      ).not.toBe(dictionarySnapshot({ label: '官网' }, true, editing));
    },
  );
  it('does not normalize dictionary codes that submission sends unchanged', () => {
    expect(dictionarySnapshot({ code: ' source ' }, false, false)).not.toBe(
      dictionarySnapshot({ code: 'source' }, false, false),
    );
  });
  it('enforces stable code format and Unicode name limits', () => {
    for (const code of [
      'source',
      'customer_source',
      'source-2',
      'a'.repeat(64),
    ])
      expect(valid('code', code)).toBe(true);
    for (const code of ['Upper', '_source', '2source', 'a.b', 'a'.repeat(65)])
      expect(valid('code', code)).toBe(false);
    expect(valid('name', '中'.repeat(128))).toBe(true);
    expect(valid('name', '中'.repeat(129))).toBe(false);
    expect(valid('name', ' ')).toBe(false);
    expect(valid('value', ' ', true)).toBe(false);
    expect(valid('sort', -1, true)).toBe(false);
    expect(valid('sort', 2_147_483_648, true)).toBe(false);
  });
  it('does not expose code, value or status changes through editing', () => {
    expect(
      dictionaryFormSchema(false, true).map((v) => v.fieldName),
    ).not.toContain('code');
    expect(
      dictionaryFormSchema(true, true).map((v) => v.fieldName),
    ).not.toContain('value');
    expect(
      dictionaryFormSchema(true, true).map((v) => v.fieldName),
    ).not.toContain('status');
  });
  it('snapshots only editable fields so untouched edit forms can close', () => {
    expect(
      dictionarySnapshot(
        { name: '来源', code: 'source', status: 1 },
        false,
        true,
      ),
    ).toBe(dictionarySnapshot({ name: '来源' }, false, true));
    expect(
      dictionarySnapshot(
        { label: '官网', value: 'web', status: 1 },
        true,
        true,
      ),
    ).toBe(dictionarySnapshot({ label: '官网' }, true, true));
    expect(dictionarySnapshot({ name: 'changed' }, false, true)).not.toBe(
      dictionarySnapshot({ name: '来源' }, false, true),
    );
  });
});

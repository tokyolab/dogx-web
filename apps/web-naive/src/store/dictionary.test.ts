import type { DictionaryApi } from '#/api/system/dictionary';

import { describe, expect, it, vi } from 'vitest';

import {
  createDictionaryCache,
  dictionaryChoices,
  dictionaryEditChoices,
  dictionaryLabel,
} from './dictionary';

vi.mock('#/api/system/dictionary', () => ({ readDictionariesApi: vi.fn() }));

const source: DictionaryApi.Options = {
  code: 'source',
  status: 1,
  items: [
    { label: '官网', value: 'web', status: 1, sort: 0 },
    { label: '历史来源', value: 'old', status: 0, sort: 1 },
  ],
};
describe('business dictionary memory cache', () => {
  it('deduplicates codes and batches only missing dictionaries', async () => {
    const reader = vi
      .fn()
      .mockResolvedValueOnce({ items: [source] })
      .mockResolvedValueOnce({
        items: [{ code: 'empty', status: 1, items: [] }],
      });
    const load = createDictionaryCache(reader);
    await load(['source', 'source']);
    await load(['source', 'empty']);
    await load(['empty', 'source']);
    expect(reader.mock.calls).toEqual([[['source']], [['empty']]]);
  });
  it('retains a loaded value until a new runtime cache is created', async () => {
    const reader = vi
      .fn()
      .mockResolvedValue({ items: [structuredClone(source)] });
    const load = createDictionaryCache(reader);
    await load(['source']);
    reader.mockResolvedValue({
      items: [
        {
          ...source,
          items: [{ label: '已修改', value: 'web', status: 1, sort: 0 }],
        },
      ],
    });
    const retained = await load(['source']);
    const refreshed = await createDictionaryCache(reader)(['source']);
    expect(retained[0]?.items[0]?.label).toBe('官网');
    expect(refreshed[0]?.items[0]?.label).toBe('已修改');
  });
  it('does not cache failed reads or a missing dictionary as an empty dictionary', async () => {
    const reader = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValue({ items: [source] });
    const load = createDictionaryCache(reader);
    await expect(load(['source'])).rejects.toThrow('offline');
    expect(await load(['source'])).toEqual([]);
    expect(await load(['source'])).toEqual([source]);
    expect(reader).toHaveBeenCalledTimes(3);
  });
  it('rejects malformed and oversized batches before requesting', async () => {
    const reader = vi.fn();
    const load = createDictionaryCache(reader);
    await expect(load(['UPPER'])).rejects.toThrow('Invalid dictionary codes');
    await expect(
      load(Array.from({ length: 51 }, (_, i) => `code${i}`)),
    ).rejects.toThrow('Invalid dictionary codes');
    expect(await load([])).toEqual([]);
    expect(reader).not.toHaveBeenCalled();
  });
  it('keeps disabled labels but excludes disabled choices and preserves saved values', () => {
    expect(dictionaryChoices(source).map((v) => v.value)).toEqual(['web']);
    expect(dictionaryChoices({ ...source, status: 0 })).toEqual([]);
    expect(dictionaryLabel(source, 'old')).toBe('历史来源');
    expect(dictionaryLabel(source, 'deleted')).toBe('deleted');
    expect(dictionaryLabel(undefined, 'unknown')).toBe('unknown');
    expect(dictionaryEditChoices(source, 'old').at(-1)).toEqual({
      label: '历史来源',
      value: 'old',
      disabled: true,
    });
    expect(dictionaryEditChoices(source, 'deleted').at(-1)).toEqual({
      label: 'deleted',
      value: 'deleted',
      disabled: true,
    });
    expect(dictionaryEditChoices(source, 'web')).toHaveLength(1);
  });
});

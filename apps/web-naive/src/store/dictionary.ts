import type { DictionaryApi } from '#/api/system/dictionary';

import { readDictionariesApi } from '#/api/system/dictionary';

type Reader = (codes: string[]) => Promise<{ items: DictionaryApi.Options[] }>;

// This cache intentionally lives only in the current page runtime. Administration writes
// and Redis cache clearing do not invalidate already loaded business options (ADR-0007).
export function createDictionaryCache(read: Reader) {
  const entries = new Map<string, DictionaryApi.Options>();
  return async (codes: string[]) => {
    const unique = [...new Set(codes)];
    if (
      unique.length > 50 ||
      unique.some((code) => !/^[a-z][a-z0-9_-]{0,63}$/.test(code))
    )
      throw new Error('Invalid dictionary codes');
    const missing = unique.filter((code) => !entries.has(code));
    if (missing.length > 0) {
      const response = await read(missing);
      for (const item of response.items)
        if (missing.includes(item.code)) entries.set(item.code, item);
    }
    return unique.flatMap((code) => {
      const item = entries.get(code);
      return item ? [item] : [];
    });
  };
}
export const loadDictionaries = createDictionaryCache(readDictionariesApi);

export function dictionaryLabel(
  dictionary: DictionaryApi.Options | undefined,
  value: string,
) {
  return dictionary?.items.find((item) => item.value === value)?.label ?? value;
}
export function dictionaryChoices(
  dictionary: DictionaryApi.Options | undefined,
) {
  return dictionary?.status === 1
    ? dictionary.items.filter((item) => item.status === 1)
    : [];
}
// Keep unavailable historical selections visible; do not silently replace a saved business value.
export function dictionaryEditChoices(
  dictionary: DictionaryApi.Options | undefined,
  value?: string,
) {
  const choices = dictionaryChoices(dictionary).map((item) => ({
    label: item.label,
    value: item.value,
    disabled: false,
  }));
  if (value && !choices.some((item) => item.value === value))
    choices.push({
      label: dictionaryLabel(dictionary, value),
      value,
      disabled: true,
    });
  return choices;
}

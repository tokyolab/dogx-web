import { describe, expect, it, vi } from 'vitest';

import { createTriggerOperation } from './trigger-operation';

describe('manual Job execution identity', () => {
  it('uses a valid UUID when randomUUID is unavailable on an internal HTTP origin', async () => {
    const original = crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: original.getRandomValues.bind(original),
    });
    try {
      const send = vi.fn().mockResolvedValue({ instanceId: 1 });
      const operation = createTriggerOperation(1, send);
      await operation.submit({ params: '', paramsOverridden: false });
      expect(operation.request?.requestId).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('retries the same immutable request after an uncertain response', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ instanceId: 42 });
    const operation = createTriggerOperation(1, send, 'fixed-request');
    await expect(
      operation.submit({ paramsOverridden: true, params: 'original' }),
    ).rejects.toThrow('timeout');
    await operation.submit({ paramsOverridden: false, params: 'changed' });
    expect(send.mock.calls[1]?.[0]).toEqual(send.mock.calls[0]?.[0]);
    expect(operation.request?.params).toBe('original');
  });
  it('coalesces double clicks and never resends a confirmed operation', async () => {
    let resolve!: (value: { instanceId: number }) => void;
    const send = vi.fn(
      () =>
        new Promise<{ instanceId: number }>((done) => {
          resolve = done;
        }),
    );
    const operation = createTriggerOperation(1, send, 'fixed-request');
    const input = { paramsOverridden: false, params: '' };
    const first = operation.submit(input);
    expect(operation.submit(input)).toBe(first);
    resolve({ instanceId: 9 });
    await first;
    await operation.submit(input);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

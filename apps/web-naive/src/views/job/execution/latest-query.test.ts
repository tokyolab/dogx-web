import { describe, expect, it } from 'vitest';

import { createLatestQuery } from './latest-query';

describe('execution list requests', () => {
  it.each([false, true])(
    'does not publish an obsolete response (old failure: %s)',
    async (failure) => {
      let finish!: (value: string[]) => void;
      let fail!: (reason: unknown) => void;
      const old = new Promise<string[]>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      const query = createLatestQuery<string[]>();
      const first = query(() => old);
      const second = query(async () => ['current filter']);
      await expect(second).resolves.toEqual(['current filter']);
      if (failure) fail(new Error('obsolete request'));
      else finish(['old filter']);
      await expect(first).resolves.toEqual(['current filter']);
    },
  );

  it('preserves a current request failure', async () => {
    const query = createLatestQuery<string[]>();
    await expect(
      query(async () => {
        throw new Error('current request');
      }),
    ).rejects.toThrow('current request');
  });
});

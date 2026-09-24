import { describe, expect, it, vi } from 'vitest';

import {
  createCredentialRefresh,
  credentialSnapshot,
} from './credential-refresh';

function setup() {
  let shared = {
    accessToken: 'A0' as null | string,
    refreshToken: 'S.R0' as null | string,
  };
  const store = {
    ...shared,
    setCredentials(value: { accessToken: string; refreshToken: string }) {
      shared = value;
      Object.assign(store, value);
    },
    syncCredentials() {
      Object.assign(store, shared);
    },
  };
  const error = {
    config: { authCredentials: credentialSnapshot(store) },
    response: { status: 401 },
  };
  return {
    store,
    error,
    update: (value: typeof shared) => {
      shared = value;
    },
  };
}

describe('cross-window refresh lifecycle', () => {
  it('reads shared credentials before refreshing a sleeping window', async () => {
    const { store, error, update } = setup();
    update({ accessToken: 'A1', refreshToken: 'S.R1' });
    const send = vi.fn();
    expect(await createCredentialRefresh(store, send).refresh(error)).toBe(
      'A1',
    );
    expect(send).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer refresh with a late success', async () => {
    const { store, error, update } = setup();
    const send = vi.fn(async () => {
      update({ accessToken: 'A2', refreshToken: 'S.R2' });
      return { accessToken: 'A1', refreshToken: 'S.R1', expiresIn: 900 };
    });
    expect(await createCredentialRefresh(store, send).refresh(error)).toBe(
      'A2',
    );
    expect(store.refreshToken).toBe('S.R2');
  });

  it.each([
    { accessToken: null, refreshToken: null },
    { accessToken: 'Other', refreshToken: 'T.R0' },
  ])(
    'does not resurrect logout or retry under another login: %j',
    async (state) => {
      const { store, error, update } = setup();
      const coordinator = createCredentialRefresh(store, async () => {
        update(state);
        return { accessToken: 'A1', refreshToken: 'S.R1', expiresIn: 900 };
      });
      await expect(coordinator.refresh(error)).rejects.toThrow(
        'session changed',
      );
      expect(store.refreshToken).toBe(state.refreshToken);
      expect(coordinator.shouldReauthenticate(error)).toBe(false);
    },
  );

  it('recovers a late failure when another window has already refreshed', async () => {
    const { store, error, update } = setup();
    const coordinator = createCredentialRefresh(store, async () => {
      update({ accessToken: 'A1', refreshToken: 'S.R1' });
      throw Object.assign(new Error('Refresh rejected'), {
        response: { status: 401 },
      });
    });
    expect(await coordinator.refresh(error)).toBe('A1');
    expect(coordinator.shouldReauthenticate(error)).toBe(false);
  });

  it('only clears the current login on confirmed authentication failure', async () => {
    const { store, error } = setup();
    const coordinator = createCredentialRefresh(store, async () => {
      throw new Error('offline');
    });
    await expect(coordinator.refresh(error)).rejects.toThrow('offline');
    expect(coordinator.shouldReauthenticate(error, {})).toBe(false);
    expect(
      coordinator.shouldReauthenticate(error, { response: { status: 503 } }),
    ).toBe(false);
    expect(
      coordinator.shouldReauthenticate(error, { response: { status: 401 } }),
    ).toBe(true);
    expect(store.refreshToken).toBe('S.R0');
  });

  it('persists a successful refresh', async () => {
    const { store, error } = setup();
    const coordinator = createCredentialRefresh(store, async () => ({
      accessToken: 'A1',
      refreshToken: 'S.R1',
      expiresIn: 900,
    }));
    expect(await coordinator.refresh(error)).toBe('A1');
    expect(store.refreshToken).toBe('S.R1');
  });
});

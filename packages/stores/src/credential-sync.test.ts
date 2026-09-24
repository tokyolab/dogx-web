import { createApp, nextTick } from 'vue';

import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';
import SecureLS from 'secure-ls';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createCredentialPersistence } from './credential-sync';
import { useAccessStore } from './modules/access';

const key = 'test-core-access';
const disposers: Array<() => void> = [];

beforeEach(() => localStorage.clear());
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

function setup(storage = localStorage) {
  const persistence = createCredentialPersistence(storage, key);
  const pinia = createPinia();
  pinia.use(
    createPersistedState({ key: () => key, storage: persistence.adapter }),
  );
  createApp({}).use(pinia);
  const store = useAccessStore(pinia);
  const changed = vi.fn();
  disposers.push(persistence.bind(store, changed));
  return { store, changed };
}

function emitStorage() {
  window.dispatchEvent(
    new StorageEvent('storage', { key, storageArea: localStorage }),
  );
}

describe('credential persistence across windows', () => {
  it('persists, restores and clears credentials through an action proxy', async () => {
    const a = setup();
    // Pinia devtools passes a new forwarding Proxy as the action's `this`.
    // Reproduce it explicitly because Pinia disables devtools in test mode.
    const actionStore = new Proxy(a.store, {
      get: Reflect.get,
      set: Reflect.set,
    });
    actionStore.setCredentials({
      accessToken: 'A0',
      refreshToken: 'S.R0',
      expiresIn: 900,
    });
    expect(JSON.parse(localStorage.getItem(key) ?? '{}').refreshToken).toBe(
      'S.R0',
    );
    await nextTick();
    const b = setup();
    expect(b.store.accessToken).toBe('A0');
    expect(b.store.refreshToken).toBe('S.R0');

    b.store.setCredentials({
      accessToken: 'A1',
      refreshToken: 'S.R1',
      expiresIn: 900,
    });
    actionStore.syncCredentials();
    expect(a.store.refreshToken).toBe('S.R1');

    actionStore.clearCredentials();
    expect(
      JSON.parse(localStorage.getItem(key) ?? '{}').refreshToken,
    ).toBeNull();
    b.store.syncCredentials();
    expect(b.store.accessToken).toBeNull();
    expect(b.changed).toHaveBeenCalledOnce();
  });

  it('synchronizes events without resetting menus or writing tokens back in a loop', async () => {
    const a = setup();
    a.store.setCredentials({
      accessToken: 'A0',
      refreshToken: 'S.R0',
      expiresIn: 900,
    });
    const b = setup();
    b.store.setAccessMenus([{ name: 'menu', path: '/menu' }]);
    a.store.setCredentials({
      accessToken: 'A1',
      refreshToken: 'S.R1',
      expiresIn: 897,
    });
    emitStorage();
    await nextTick();
    expect(b.store.accessToken).toBe('A1');
    expect(b.store.refreshToken).toBe('S.R1');
    expect(b.store.accessMenus).toHaveLength(1);
    expect(b.changed).not.toHaveBeenCalled();
    const persisted = localStorage.getItem(key);
    emitStorage();
    await nextTick();
    expect(localStorage.getItem(key)).toBe(persisted);
  });

  it('does not overwrite new credentials when a sleeping window changes other state', async () => {
    const a = setup();
    a.store.setCredentials({
      accessToken: 'A0',
      refreshToken: 'S.R0',
      expiresIn: 900,
    });
    const b = setup();
    a.store.setCredentials({
      accessToken: 'A1',
      refreshToken: 'S.R1',
      expiresIn: 900,
    });
    b.store.lockScreen('lock-password');
    await nextTick();
    expect(JSON.parse(localStorage.getItem(key) ?? '{}').refreshToken).toBe(
      'S.R1',
    );
    expect(b.store.refreshToken).toBe('S.R0');
    b.store.syncCredentials();
    expect(b.store.refreshToken).toBe('S.R1');
  });

  it('synchronizes logout and requests a reload on a different session', () => {
    const a = setup();
    a.store.setCredentials({
      accessToken: 'A',
      refreshToken: 'S.R',
      expiresIn: 900,
    });
    const b = setup();
    a.store.clearCredentials();
    emitStorage();
    expect(b.store.accessToken).toBeNull();
    expect(b.changed).toHaveBeenCalledOnce();
    a.store.setCredentials({
      accessToken: 'B',
      refreshToken: 'T.R',
      expiresIn: 900,
    });
    b.store.syncCredentials();
    expect(b.changed).toHaveBeenCalledTimes(2);
    expect(b.store.refreshToken).toBe('T.R');
  });

  it('uses the same SecureLS decoder instead of parsing ciphertext as JSON', () => {
    const module = SecureLS as unknown as {
      default?: typeof SecureLS;
      SecureLS?: typeof SecureLS;
    };
    const Constructor = module.default ?? module.SecureLS ?? SecureLS;
    const ls = new Constructor({
      encodingType: 'aes',
      encryptionSecret: 'test-key',
      isCompression: true,
    });
    const storage = {
      ...localStorage,
      getItem: (name: string) => ls.get(name),
      setItem: (name: string, value: string) => ls.set(name, value),
    } as Storage;
    const a = setup(storage);
    a.store.setCredentials({
      accessToken: 'A0',
      refreshToken: 'S.R0',
      expiresIn: 900,
    });
    const b = setup(storage);
    a.store.setCredentials({
      accessToken: 'A1',
      refreshToken: 'S.R1',
      expiresIn: 900,
    });
    emitStorage();
    expect(b.store.refreshToken).toBe('S.R1');
    expect(localStorage.getItem(key)).not.toContain('S.R1');
  });

  it('ignores unrelated keys and clears memory on external storage removal', () => {
    const a = setup();
    a.store.setCredentials({
      accessToken: 'A',
      refreshToken: 'S.R',
      expiresIn: 900,
    });
    localStorage.removeItem(key);
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'unrelated',
        storageArea: localStorage,
      }),
    );
    expect(a.store.accessToken).toBe('A');
    emitStorage();
    expect(a.store.accessToken).toBeNull();
    expect(a.changed).toHaveBeenCalledOnce();
  });
});

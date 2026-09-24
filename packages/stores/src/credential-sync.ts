import { toRaw } from 'vue';

export interface CredentialState {
  accessToken: null | string;
  accessTokenExpiresAt: null | number;
  refreshToken: null | string;
}

interface CredentialStore extends CredentialState {
  $patch(state: Partial<CredentialState>): void;
}

interface StorageAdapter {
  getItem(key: string): null | string;
  setItem(key: string, value: string): void;
}

const emptyCredentials: CredentialState = {
  accessToken: null,
  accessTokenExpiresAt: null,
  refreshToken: null,
};
// Pinia devtools wraps an action's `this` in another Proxy. Always key bindings
// by the raw store, or actions miss the binding and fail to persist credentials.
const bindings = new WeakMap<
  CredentialStore,
  {
    read(): void;
    write(state: CredentialState): void;
  }
>();

function credentialsFrom(value: Record<string, unknown>): CredentialState {
  return {
    accessToken:
      typeof value.accessToken === 'string' ? value.accessToken : null,
    accessTokenExpiresAt:
      typeof value.accessTokenExpiresAt === 'number'
        ? value.accessTokenExpiresAt
        : null,
    refreshToken:
      typeof value.refreshToken === 'string' ? value.refreshToken : null,
  };
}

export function credentialSession(state: CredentialState) {
  return state.refreshToken?.split('.')[0] ?? null;
}

export function syncStoredCredentials(store: CredentialStore) {
  bindings.get(toRaw(store))?.read();
}

export function writeStoredCredentials(
  store: CredentialStore,
  state: CredentialState,
) {
  const binding = bindings.get(toRaw(store));
  if (binding) binding.write(state);
  else store.$patch(state);
}

// Reuse the existing decoded persistence adapter (plain localStorage or SecureLS).
// Only explicit credential actions may replace credentials. An unrelated store
// mutation in a sleeping tab must not persist its obsolete token snapshot.
export function createCredentialPersistence(
  storage: StorageAdapter,
  key: string,
) {
  function readRecord(): Record<string, unknown> {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid authentication storage');
    }
    return value as Record<string, unknown>;
  }

  const adapter: StorageAdapter = {
    getItem: (name) => storage.getItem(name),
    setItem(name, value) {
      if (name !== key) {
        storage.setItem(name, value);
        return;
      }
      const merged = JSON.stringify({
        ...JSON.parse(value),
        ...credentialsFrom(readRecord()),
      });
      if (storage.getItem(name) !== merged) storage.setItem(name, merged);
    },
  };

  function bind(store: CredentialStore, onSessionChange: () => void) {
    function read() {
      const next = credentialsFrom(readRecord());
      const changedSession =
        credentialSession(store) !== credentialSession(next);
      if (
        store.accessToken === next.accessToken &&
        store.refreshToken === next.refreshToken &&
        store.accessTokenExpiresAt === next.accessTokenExpiresAt
      )
        return;
      store.$patch(next);
      // A different login must not inherit the previous user's menus/profile.
      if (changedSession) onSessionChange();
    }
    bindings.set(toRaw(store), {
      read,
      write(state) {
        storage.setItem(key, JSON.stringify({ ...readRecord(), ...state }));
        store.$patch(state);
      },
    });
    const listener = (event: StorageEvent) => {
      if (
        event.storageArea !== localStorage ||
        (event.key !== key && event.key !== null)
      )
        return;
      // Read the current value rather than an event payload that may already be stale.
      try {
        read();
      } catch {
        store.$patch(emptyCredentials);
        onSessionChange();
      }
    };
    window.addEventListener('storage', listener);
    return () => {
      bindings.delete(toRaw(store));
      window.removeEventListener('storage', listener);
    };
  }

  return { adapter, bind };
}

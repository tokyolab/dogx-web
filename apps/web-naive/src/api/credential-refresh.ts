import { CanceledError } from '@vben/request';

interface Credentials {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

interface CredentialStore {
  accessToken: null | string;
  refreshToken: null | string;
  setCredentials(value: Credentials): void;
  syncCredentials(): void;
}

export interface CredentialSnapshot {
  accessToken: null | string;
  sessionId: null | string;
}

export interface AuthFailure {
  config?: { authCredentials?: CredentialSnapshot };
  response?: { status?: number };
}

export function credentialSnapshot(store: CredentialStore): CredentialSnapshot {
  return {
    accessToken: store.accessToken,
    sessionId: store.refreshToken?.split('.')[0] ?? null,
  };
}

// Kept outside the HTTP client so cross-window races can be exercised without
// mounting the application or logging real test accounts in and out.
export function createCredentialRefresh(
  store: CredentialStore,
  send: (token: string) => Promise<Credentials>,
) {
  function sameSession(snapshot: CredentialSnapshot | undefined) {
    return (
      typeof snapshot?.sessionId === 'string' &&
      snapshot.sessionId.length > 0 &&
      snapshot.sessionId === credentialSnapshot(store).sessionId
    );
  }

  async function refresh(error?: AuthFailure) {
    const snapshot = error?.config?.authCredentials;
    store.syncCredentials();
    if (!sameSession(snapshot))
      throw new CanceledError('Authentication session changed');
    if (store.accessToken && snapshot?.accessToken !== store.accessToken)
      return store.accessToken;
    const refreshToken = store.refreshToken;
    if (!refreshToken) throw new Error('Refresh token is unavailable');

    try {
      const credentials = await send(refreshToken);
      store.syncCredentials();
      if (!sameSession(snapshot))
        throw new CanceledError('Authentication session changed');
      // A late response must not overwrite a later refresh, logout or new login.
      if (store.refreshToken !== refreshToken) {
        if (store.accessToken) return store.accessToken;
        throw new CanceledError('Authentication credentials changed');
      }
      store.setCredentials(credentials);
      return credentials.accessToken;
    } catch (error_) {
      store.syncCredentials();
      // A late response belongs to the old login. Cancel both success and failure
      // paths so logout/new login does not produce an unrelated error toast.
      if (!sameSession(snapshot))
        throw new CanceledError('Authentication session changed');
      if (store.accessToken && store.refreshToken !== refreshToken)
        return store.accessToken;
      throw error_;
    }
  }

  function shouldReauthenticate(
    error?: AuthFailure,
    refreshError?: AuthFailure,
  ) {
    store.syncCredentials();
    const snapshot = error?.config?.authCredentials;
    // Network errors and 5xx responses are not evidence of a revoked session.
    return (
      (refreshError ?? error)?.response?.status === 401 &&
      sameSession(snapshot) &&
      snapshot?.accessToken === store.accessToken
    );
  }

  return { refresh, shouldReauthenticate };
}

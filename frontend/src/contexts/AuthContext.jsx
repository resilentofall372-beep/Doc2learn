import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, errorMessage } from '../services/api';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../utils/constants';

export const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const clearSession = () => {
  storage.remove(STORAGE_KEYS.AUTH_TOKEN);
  storage.remove(STORAGE_KEYS.USER_DATA);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.get(STORAGE_KEYS.USER_DATA));
  // With a stored session, render straight away (sidebar and all) and confirm the token in the
  // background; only a visitor with a token but no stored user waits for the check.
  const [loading, setLoading] = useState(
    () => Boolean(storage.get(STORAGE_KEYS.AUTH_TOKEN)) && !storage.get(STORAGE_KEYS.USER_DATA)
  );

  const persist = useCallback((token, userInfo) => {
    storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    storage.set(STORAGE_KEYS.USER_DATA, userInfo);
    setUser(userInfo);
  }, []);

  /** Revoke the session on the server (all devices), then forget it locally. */
  const logout = useCallback(async () => {
    try {
      if (storage.get(STORAGE_KEYS.AUTH_TOKEN)) await authAPI.logout();
    } catch {
      /* the token may already be invalid; clearing locally is enough then */
    }
    clearSession();
    setUser(null);
  }, []);

  // On load, confirm the stored token is still valid.
  useEffect(() => {
    let cancelled = false;
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      setUser(null);
      setLoading(false);
      return undefined;
    }
    authAPI
      .me()
      .then((res) => {
        if (!cancelled) {
          storage.set(STORAGE_KEYS.USER_DATA, res.data.user);
          setUser(res.data.user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      try {
        const res = await authAPI.login({ email, password });
        persist(res.data.token, res.data.user);
        return { success: true };
      } catch (error) {
        return { success: false, error: errorMessage(error, 'Login failed') };
      }
    },
    [persist]
  );

  const signup = useCallback(
    async ({ name, email, password }) => {
      try {
        const res = await authAPI.register({ name, email, password });
        persist(res.data.token, res.data.user);
        return { success: true };
      } catch (error) {
        return { success: false, error: errorMessage(error, 'Signup failed') };
      }
    },
    [persist]
  );

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, signup, logout }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

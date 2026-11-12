import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => storage.get(STORAGE_KEYS.USER_DATA));
  const [loading, setLoading] = useState(true);

  const persist = useCallback((token, userInfo) => {
    storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    storage.set(STORAGE_KEYS.USER_DATA, userInfo);
    setUser(userInfo);
  }, []);

  const logout = useCallback(() => {
    storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    storage.remove(STORAGE_KEYS.USER_DATA);
    setUser(null);
  }, []);

  // On load, confirm the stored token is still valid.
  useEffect(() => {
    let cancelled = false;
    const token = storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
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
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

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

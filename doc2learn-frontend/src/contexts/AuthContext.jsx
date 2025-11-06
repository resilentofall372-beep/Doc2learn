import React, { createContext, useState, useContext, useEffect } from 'react';
import { storage } from '../services/storage';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data on app start
    const storedUser = storage.get('user');
    if (storedUser) {
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = async (credentials) => {
    try {
      const { email, password } = credentials;
      
      // Simple validation
      if (!email || !password) {
        return { success: false, error: 'Email and password are required' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Mock successful login - NO API CALLS
      const userInfo = {
        uid: 'user-' + Date.now(),
        email: email,
        name: email.split('@')[0], // Use email prefix as name
        user_id: 'user-' + Date.now()
      };

      console.log('✅ Login successful:', userInfo);

      // Store in localStorage
      storage.set('authToken', 'mock-jwt-token');
      storage.set('user', userInfo);
      setUser(userInfo);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed. Please try again.' };
    }
  };

  const signup = async (userData) => {
    try {
      const { email, password, name } = userData;
      
      // Simple validation
      if (!email || !password || !name) {
        return { success: false, error: 'All fields are required' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' };
      }

      // Mock successful signup - NO API CALLS
      const userInfo = {
        uid: 'user-' + Date.now(),
        email: email,
        name: name,
        user_id: 'user-' + Date.now()
      };

      console.log('✅ Signup successful:', userInfo);

      // Store in localStorage
      storage.set('authToken', 'mock-jwt-token');
      storage.set('user', userInfo);
      setUser(userInfo);

      return { success: true };
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Signup failed. Please try again.' };
    }
  };

  const loginWithGoogle = async () => {
    // Mock Google login - completely disabled
    return { 
      success: false, 
      error: 'Google login is temporarily disabled. Please use email/password.' 
    };
  };

  const logout = async () => {
    storage.clear();
    setUser(null);
    console.log('✅ Logout successful');
  };

  const updateUser = (userData) => {
    setUser(userData);
    storage.set('user', userData);
  };

  const value = {
    user,
    firebaseUser: null, // Set to null to avoid Firebase issues
    login,
    signup,
    loginWithGoogle,
    logout,
    updateUser,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
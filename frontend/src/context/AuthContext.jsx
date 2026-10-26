'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage or API on initial mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const cachedUser = localStorage.getItem('auth_user');

        if (cachedUser) {
          setUser(JSON.parse(cachedUser));
        }

        if (token) {
          const res = await api.get('/auth/me/');
          setUser(res.data);
          localStorage.setItem('auth_user', JSON.stringify(res.data));
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/token/', { email, password });
    const { access, refresh, user: userData } = res.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('auth_user', JSON.stringify(userData));

    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register/', userData);
    const { access, refresh, user: newUser } = res.data;

    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('auth_user', JSON.stringify(newUser));

    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me/');
      setUser(res.data);
      localStorage.setItem('auth_user', JSON.stringify(res.data));
      return res.data;
    } catch (err) {
      console.error('Error refreshing user:', err);
      return null;
    }
  };

  const isProvider = user?.role === 'provider';
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isProvider,
        isCustomer,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

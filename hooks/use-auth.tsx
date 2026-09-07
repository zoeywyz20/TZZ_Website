'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { type Profile } from '@/types';
import { authApi } from '@/lib/api/auth';

interface AuthContextType {
  user: Profile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ requiresPasswordChange: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  unreadCount: number;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();

  const isAuthenticated = user !== null;
  const unreadCount = 0;

  const refreshUser = useCallback(async () => {
    try { setUser(await authApi.me()); } catch { setUser(null); }
  }, []);

  useEffect(() => {
    let active = true;
    authApi.me().then((currentUser) => { if (active) setUser(currentUser); }).catch(() => { if (active) setUser(null); }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const currentUser = await authApi.login(email, password);
    setUser(currentUser);
    return { requiresPasswordChange: currentUser.requiresPasswordChange };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout, refreshUser, unreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

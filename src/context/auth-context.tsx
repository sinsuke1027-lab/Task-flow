'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, DataProvider } from '@/lib/repository/types';
import { getDataProvider } from '@/lib/repository/factory';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (userId: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      const storedUserId = localStorage.getItem('task_bridge_user_id');
      if (storedUserId) {
        const provider = getDataProvider();
        const p = provider as DataProvider & { setCurrentUser?: (id: string) => void };
        p.setCurrentUser?.(storedUserId);
        const currentUser = await provider.getCurrentUser();
        setUser(currentUser);
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (userId: string) => {
    const provider = getDataProvider();
    const p = provider as DataProvider & { setCurrentUser?: (id: string) => void };
    p.setCurrentUser?.(userId);
    const currentUser = await provider.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      localStorage.setItem('task_bridge_user_id', userId);
      router.push('/');
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('task_bridge_user_id');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { User, DataProvider } from '@/lib/repository/types';
import { getDataProvider } from '@/lib/repository/factory';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      // Mock mode: restore session from localStorage
      const initMockAuth = async () => {
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
      initMockAuth();
      return;
    }

    // Supabase mode: subscribe to auth state changes (session stored in cookies)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user?.email) {
        const provider = getDataProvider();
        const users = await provider.getUsers();
        const matched = users.find(u => u.email === session.user!.email) ?? null;
        setUser(matched);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    // Trigger initial session check
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (!session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      // Mock mode: find user by email, password is ignored
      const provider = getDataProvider();
      const users = await provider.getUsers();
      const matched = users.find(u => u.email === email);
      if (!matched) throw new Error('ユーザーが見つかりません');
      const p = provider as DataProvider & { setCurrentUser?: (id: string) => void };
      p.setCurrentUser?.(matched.id);
      setUser(matched);
      localStorage.setItem('task_bridge_user_id', matched.id);
      router.push('/');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    router.push('/');
  };

  const logout = () => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setUser(null);
      localStorage.removeItem('task_bridge_user_id');
      router.push('/login');
      return;
    }

    supabase.auth.signOut().then(() => {
      setUser(null);
      router.push('/login');
    });
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

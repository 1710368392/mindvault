/**
 * useAuth - 认证状态管理 Hook
 * 管理用户登录/注册/登出，监听 Supabase Auth 状态变化
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CloudUser } from '@shared/auth-types';
import type { Session, AuthError } from '@supabase/supabase-js';

interface UseAuthReturn {
  user: CloudUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: { nickname?: string; avatar?: string }) => Promise<void>;
}

/** 将 Supabase Session 映射为 CloudUser */
function mapSessionToUser(session: Session | null): CloudUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata || {};
  return {
    id: session.user.id,
    email: session.user.email || '',
    nickname: meta.nickname || '用户',
    avatar: meta.avatar || null,
    createdAt: session.user.created_at,
    lastSignInAt: session.user.last_sign_in_at,
  };
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<CloudUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoading(false);
      return;
    }

    // 获取当前 session（恢复已有登录状态）
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(mapSessionToUser(session));
      // 同步 session 到主进程（用于数据同步）
      if (session?.access_token && window.electronAPI?.auth) {
        try {
          await window.electronAPI.auth.syncSession(session.access_token);
        } catch (e) {
          console.warn('[useAuth] session 同步到主进程失败:', e);
        }
      }
      setIsLoading(false);
    });

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newUser = mapSessionToUser(session);
        setUser(newUser);

        // 同步 session 到主进程
        if (window.electronAPI?.auth) {
          try {
            if (session?.access_token) {
              await window.electronAPI.auth.syncSession(session.access_token);
            } else {
              await window.electronAPI.auth.syncSession('');
            }
          } catch (e) {
            console.warn('[useAuth] session 同步失败:', e);
          }
        }

        // 首次登录时触发全量下载
        if (event === 'SIGNED_IN' && session && window.electronAPI?.auth) {
          try {
            await window.electronAPI.auth.downloadAll();
          } catch (e) {
            console.warn('[useAuth] 全量下载触发失败:', e);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, nickname: string) => {
    if (!supabase) {
      return { error: { name: 'Error', message: 'Supabase 未配置，请在 .env 中设置环境变量', status: 0, meta: {} } as AuthError };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname } },
    });
    return { error };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: { name: 'Error', message: 'Supabase 未配置', status: 0, meta: {} } as AuthError };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates: { nickname?: string; avatar?: string }) => {
    if (!supabase || !user) return;
    await supabase.auth.updateUser({ data: { ...updates } });
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
}

/**
 * Supabase 客户端（渲染进程）
 * 在渲染进程中初始化，利用 localStorage 自动持久化 session
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://your-project.supabase.co') {
  console.warn('[Supabase] 缺少环境变量或未配置，云同步功能不可用，将使用纯本地模式');
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://your-project.supabase.co'
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,    // 自动刷新 Token
          persistSession: true,      // 使用 localStorage 持久化 session
          detectSessionInUrl: false, // Electron 不需要从 URL 检测 session
          flowType: 'pkce',          // 使用 PKCE 增强安全性
        },
      })
    : null;

/** Supabase 是否已正确配置 */
export const isSupabaseConfigured = !!supabase;

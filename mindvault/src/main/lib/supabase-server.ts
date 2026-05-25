// @ts-nocheck
/**
 * 主进程 Supabase 客户端
 * 仅使用 Anon Key，不使用 Service Role Key
 * 用于数据同步服务中的服务端操作
 */

let supabaseClient = null;

function initSupabaseServer() {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey || url === 'https://your-project.supabase.co') {
      console.warn('[Supabase Server] 未配置或使用默认值，跳过初始化');
      return;
    }

    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[Supabase Server] 客户端初始化成功');
  } catch (e) {
    console.error('[Supabase Server] 初始化失败:', e.message);
  }
}

function getSupabaseClient() {
  return supabaseClient;
}

function isSupabaseServerReady() {
  return !!supabaseClient;
}

module.exports = { initSupabaseServer, getSupabaseClient, isSupabaseServerReady };

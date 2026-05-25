// @ts-nocheck
/**
 * 认证 IPC 处理器
 * 处理渲染进程与主进程之间的认证相关通信
 */

const { ipcMain } = require('electron');
const dataSync = require('../services/data-sync');
const { getSupabaseClient, isSupabaseServerReady } = require('../lib/supabase-server');

function registerAuthHandlers() {
  // 接收渲染进程的 session token，设置到 dataSync 服务
  ipcMain.handle('auth:sync-session', async (event, accessToken) => {
    try {
      if (!isSupabaseServerReady() || !accessToken) {
        dataSync.setUserId(null);
        dataSync.setAccessToken(null);
        return { success: false };
      }

      const supabase = getSupabaseClient();
      // 使用 token 获取用户信息
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);
      if (error || !user) {
        console.warn('[Auth IPC] 获取用户信息失败:', error?.message);
        dataSync.setUserId(null);
        dataSync.setAccessToken(null);
        return { success: false };
      }

      dataSync.setUserId(user.id);
      dataSync.setAccessToken(accessToken);
      console.log('[Auth IPC] Session 同步成功, userId:', user.id.substring(0, 8) + '...');
      return { success: true, userId: user.id };
    } catch (e) {
      console.error('[Auth IPC] session 同步失败:', e);
      dataSync.setUserId(null);
      dataSync.setAccessToken(null);
      return { success: false };
    }
  });

  // 首次登录时全量下载
  ipcMain.handle('auth:download-all', async (event) => {
    try {
      const repo = require('../db/repository');
      if (!repo.db) {
        return { success: false, error: '数据库不可用' };
      }
      const result = await dataSync.downloadAllData(repo.db);
      return result;
    } catch (e) {
      console.error('[Auth IPC] 全量下载失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 首次登录时全量上传（将本地已有数据上传到云端）
  ipcMain.handle('auth:upload-all', async (event) => {
    try {
      const repo = require('../db/repository');
      if (!repo.db) {
        return { success: false, error: '数据库不可用' };
      }
      const result = await dataSync.uploadAllData(repo.db);
      return result;
    } catch (e) {
      console.error('[Auth IPC] 全量上传失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取同步状态
  ipcMain.handle('auth:sync-status', () => {
    return {
      userId: dataSync.getUserId(),
      configured: isSupabaseServerReady(),
    };
  });

  console.log('[IPC] 认证处理器已注册');
}

module.exports = { registerAuthHandlers };

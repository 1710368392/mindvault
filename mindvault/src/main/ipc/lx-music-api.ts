// @ts-nocheck
const { ipcMain } = require('electron');
const lxMusicApi = require('../services/lx-music-api');

function registerLxMusicApiHandlers() {
  ipcMain.handle('lx-music:check-status', async () => {
    try {
      const result = await lxMusicApi.checkStatus();
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('lx-music:get-url', async (_event, params) => {
    try {
      const { source, songId, quality, fallback, crossSource, songName, singer } = params;
      if (crossSource && songName) {
        const result = await lxMusicApi.getSongUrlWithCrossSource(source, songId, quality, songName, singer);
        return result;
      }
      if (fallback) {
        const result = await lxMusicApi.getSongUrlWithFallback(source, songId, quality);
        return result;
      }
      const result = await lxMusicApi.getSongUrl(source, songId, quality);
      return result;
    } catch (e) {
      console.error('[IPC:lx-music] 获取URL失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('lx-music:get-info', async (_event, params) => {
    try {
      const { source, songId } = params;
      const result = await lxMusicApi.getSongInfo(source, songId);
      return result;
    } catch (e) {
      console.error('[IPC:lx-music] 获取歌曲信息失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('lx-music:get-lyric', async (_event, params) => {
    try {
      const { source, songId } = params;
      const result = await lxMusicApi.getLyric(source, songId);
      return result;
    } catch (e) {
      console.error('[IPC:lx-music] 获取歌词失败:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('lx-music:set-api-url', async (_event, url) => {
    try {
      lxMusicApi.setApiUrl(url);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('lx-music:get-api-url', async () => {
    return { success: true, data: { url: lxMusicApi.getApiUrl() } };
  });

  ipcMain.handle('lx-music:get-sources', async () => {
    return {
      success: true,
      data: {
        sources: lxMusicApi.SUPPORTED_SOURCES.map((s) => ({
          id: s,
          name: lxMusicApi.SOURCE_NAMES[s],
        })),
      },
    };
  });

  ipcMain.handle('lx-music:sync-qq-credentials', async (_event, cookie) => {
    try {
      const result = await lxMusicApi.syncQQCredentials(cookie);
      return result;
    } catch (e) {
      console.error('[IPC:lx-music] 同步QQ凭证失败:', e);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] lx-music-api 处理器已注册');
}

module.exports = { registerLxMusicApiHandlers };

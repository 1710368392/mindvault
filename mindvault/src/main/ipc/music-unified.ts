// @ts-nocheck
const { ipcMain } = require('electron');
const musicUnified = require('../services/music-unified');

function registerMusicUnifiedHandlers() {
  ipcMain.handle('music-unified:search-qq', async (_event, params) => {
    try {
      const { keyword, page, limit } = params;
      const results = await musicUnified.searchQQ(keyword, page, limit);
      return { success: true, data: results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:search-netease', async (_event, params) => {
    try {
      const { keyword, page, limit } = params;
      const results = await musicUnified.searchNetease(keyword, page, limit);
      return { success: true, data: results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:search-all', async (_event, params) => {
    try {
      const { keyword, page, limit } = params;
      const results = await musicUnified.searchAll(keyword, page, limit);
      return { success: true, data: results };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:get-qq-url', async (_event, params) => {
    try {
      const { songmid, quality } = params;
      return await musicUnified.getQQSongUrl(songmid, quality);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:get-netease-url', async (_event, params) => {
    try {
      const { songId, cookie } = params;
      return await musicUnified.getNeteaseSongUrl(songId, cookie);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:get-qq-lyric', async (_event, params) => {
    try {
      const { songmid } = params;
      return await musicUnified.getQQLyric(songmid);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:get-netease-lyric', async (_event, params) => {
    try {
      const { songId, cookie } = params;
      return await musicUnified.getNeteaseLyric(songId, cookie);
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('music-unified:get-qq-toplist', async () => {
    return await musicUnified.getQQTopList();
  });

  ipcMain.handle('music-unified:get-qq-top-detail', async (_event, params) => {
    return await musicUnified.getQQTopDetail(params.topId);
  });

  ipcMain.handle('music-unified:get-qq-songlist', async (_event, params) => {
    return await musicUnified.getQQSonglist(params.id);
  });

  ipcMain.handle('music-unified:set-qq-cookie', async (_event, cookie) => {
    musicUnified.setQQCookie(cookie);
    return { success: true };
  });

  ipcMain.handle('music-unified:get-qq-cookie', async () => {
    return { success: true, data: { cookie: musicUnified.getQQCookie() } };
  });

  ipcMain.handle('music-unified:set-netease-cookie', async (_event, cookie) => {
    musicUnified.setNeteaseCookie(cookie);
    return { success: true };
  });

  ipcMain.handle('music-unified:refresh-qq-login', async () => {
    return await musicUnified.refreshQQLogin();
  });

  ipcMain.handle('music-unified:get-qq-user-info', async () => {
    return await musicUnified.getQQUserInfo();
  });

  console.log('[IPC] music-unified 处理器已注册');
}

module.exports = { registerMusicUnifiedHandlers };

// @ts-nocheck
/**
 * 在线音乐 IPC 通道注册
 * 处理渲染进程与主进程之间的在线音乐通信
 */
const { ipcMain } = require('electron');
const musicOnline = require('../services/music-online');
const qqLogin = require('../services/qq-login');

function registerMusicOnlineHandlers() {
  // 搜索歌曲
  ipcMain.handle('music-online:search', async (_event, params) => {
    try {
      const { keyword, page, limit } = params || {};
      const result = await musicOnline.searchSongs(keyword, page, limit);
      return { success: true, data: result };
    } catch (e) {
      console.error('[MusicOnline] search error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 获取播放链接
  ipcMain.handle('music-online:get-url', async (_event, params) => {
    try {
      const { songmid } = params || {};
      const url = await musicOnline.getSongUrl(songmid);
      return { success: true, data: { url } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 获取歌词
  ipcMain.handle('music-online:get-lyric', async (_event, songmid) => {
    try {
      const result = await musicOnline.getLyric(songmid);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 获取歌曲详情
  ipcMain.handle('music-online:get-detail', async (_event, songmids) => {
    try {
      const result = await musicOnline.getSongDetail(songmids);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 获取歌曲完整详情（用于侧边栏展示）
  ipcMain.handle('music-online:get-full-detail', async (_event, songId) => {
    try {
      const result = await musicOnline.getSongFullDetail(songId);
      return { success: true, data: result };
    } catch (e) {
      console.error('[MusicOnline] get-full-detail error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 设置 Cookie
  ipcMain.handle('music-online:set-cookie', async (_event, cookie) => {
    try {
      musicOnline.setCookie(cookie);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 获取 Cookie
  ipcMain.handle('music-online:get-cookie', async () => {
    try {
      const cookie = musicOnline.getCookie();
      return { success: true, data: { cookie } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 网易云音乐不需要 cookie 即可搜索和播放免费歌曲
  // 保留 set-cookie 和 get-cookie 接口以兼容前端逻辑

  // QQ 登录 - 打开登录窗口（阻塞直到登录成功或窗口关闭）
  ipcMain.handle('music-online:login-open', async () => {
    try {
      const cookie = await qqLogin.openLoginWindow();
      if (cookie) {
        musicOnline.setCookie(cookie);
        musicOnline.setSetting('qqMusicCookie', cookie);
        try {
          const lxMusicApi = require('../services/lx-music-api');
          await lxMusicApi.syncQQCredentials(cookie);
        } catch (e) {
          console.error('[music-online] 同步QQ凭证到lx-music-api失败:', e);
        }
        return { success: true, data: { cookie } };
      }
      return { success: false, error: '用户取消了登录' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // QQ 登录 - 获取登录窗口状态
  ipcMain.handle('music-online:login-status', async () => {
    try {
      const status = qqLogin.getLoginWindowStatus();
      return { success: true, data: { status } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // QQ 登录 - 关闭登录窗口
  ipcMain.handle('music-online:login-close', async () => {
    try {
      qqLogin.closeLoginWindow();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // 网易云音乐登录（需求7）
  // ============================================================

  // 网易云登录 - 打开登录窗口
  ipcMain.handle('music-online:login-netease', async () => {
    try {
      const cookie = await musicOnline.loginNetease();
      if (cookie) {
        musicOnline.setCookie(cookie);
        // 同步网易云 cookie 到 settings 表，以便持久化
        musicOnline.setSetting('neteaseCookie', cookie);
        return { success: true, data: { cookie } };
      }
      return { success: false, error: '用户取消了登录' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 网易云登录 - 获取登录窗口状态
  ipcMain.handle('music-online:login-netease-status', async () => {
    try {
      const status = musicOnline.getNeteaseLoginStatus();
      return { success: true, data: { status } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // 网易云登录 - 关闭登录窗口
  ipcMain.handle('music-online:login-netease-close', async () => {
    try {
      musicOnline.closeNeteaseLoginWindow();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // 榜单功能（需求8）
  // ============================================================

  // 获取所有榜单
  ipcMain.handle('music-online:get-charts', async () => {
    try {
      const result = await musicOnline.getChartList();
      return { success: true, data: result };
    } catch (e) {
      console.error('[MusicOnline] get-charts error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 获取榜单歌曲
  ipcMain.handle('music-online:get-chart-songs', async (_event, params) => {
    try {
      const { chartId, limit } = params || {};
      const result = await musicOnline.getChartDetail(chartId, limit || 5);
      return { success: true, data: result };
    } catch (e) {
      console.error('[MusicOnline] get-chart-songs error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // 账号管理功能（需求9）
  // ============================================================

  // 获取网易云用户信息
  ipcMain.handle('music-online:get-netease-user', async () => {
    try {
      const userInfo = await musicOnline.getNeteaseUserInfo();
      if (userInfo) {
        return { success: true, data: userInfo };
      }
      return { success: false, error: '未获取到用户信息，可能未登录' };
    } catch (e) {
      console.error('[MusicOnline] get-netease-user error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 检查网易云登录状态
  ipcMain.handle('music-online:check-netease-login', async () => {
    try {
      const result = await musicOnline.checkNeteaseLogin();
      return { success: true, data: result };
    } catch (e) {
      console.error('[MusicOnline] check-netease-login error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 保存账号（登录成功后自动调用）
  ipcMain.handle('music-online:save-account', async (_event, params) => {
    try {
      const { platform, accountInfo } = params || {};
      const result = await musicOnline.saveAccount(platform, accountInfo);
      return { success: result };
    } catch (e) {
      console.error('[MusicOnline] save-account error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 获取所有已保存的账号
  ipcMain.handle('music-online:get-saved-accounts', async (_event, platform) => {
    try {
      const accounts = musicOnline.getSavedAccounts(platform);
      return { success: true, data: { accounts } };
    } catch (e) {
      console.error('[MusicOnline] get-saved-accounts error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 删除已保存的账号
  ipcMain.handle('music-online:delete-account', async (_event, params) => {
    try {
      const { platform, userId } = params || {};
      const result = await musicOnline.deleteAccount(platform, userId);
      return { success: result };
    } catch (e) {
      console.error('[MusicOnline] delete-account error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 切换账号
  ipcMain.handle('music-online:switch-account', async (_event, params) => {
    try {
      const { platform, userId } = params || {};
      const result = await musicOnline.switchAccount(platform, userId);
      if (result) {
        return { success: true, data: result };
      }
      return { success: false, error: '切换账号失败' };
    } catch (e) {
      console.error('[MusicOnline] switch-account error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // 登出当前账号
  ipcMain.handle('music-online:logout-netease', async () => {
    try {
      const result = await musicOnline.logoutNetease();
      return { success: result };
    } catch (e) {
      console.error('[MusicOnline] logout-netease error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // 在线歌曲下载（需求10）
  // ============================================================

  // 下载在线歌曲
  ipcMain.handle('music-online:download-song', async (_event, songInfo) => {
    try {
      const result = await musicOnline.downloadSong(songInfo);
      return result;
    } catch (e) {
      console.error('[MusicOnline] download-song error:', e.message);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] 音乐在线服务处理器已注册');
}

module.exports = { registerMusicOnlineHandlers };

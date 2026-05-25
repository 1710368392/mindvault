// @ts-nocheck
/**
 * 音乐库 IPC 处理器
 * 注册音乐相关的 IPC 通道
 */

const { ipcMain } = require('electron');
const musicLibrary = require('../services/music-library');
const multiSourceMusic = require('../services/multi-source-music');

function registerMusicHandlers() {
  // 导入多个音频文件
  ipcMain.handle('music:import-files', async (_event, filePaths) => {
    try {
      const tracks = await musicLibrary.importFiles(filePaths);
      return { success: true, data: tracks };
    } catch (e) {
      console.error('[IPC:音乐] 导入文件失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取所有曲目
  ipcMain.handle('music:get-all-tracks', async () => {
    try {
      const tracks = musicLibrary.getAllTracks();
      return { success: true, data: tracks };
    } catch (e) {
      console.error('[IPC:音乐] 获取所有曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取单个曲目
  ipcMain.handle('music:get-track', async (_event, id) => {
    try {
      const track = musicLibrary.getTrack(id);
      return { success: true, data: track };
    } catch (e) {
      console.error('[IPC:音乐] 获取曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 删除曲目
  ipcMain.handle('music:delete-track', async (_event, id) => {
    try {
      const result = musicLibrary.deleteTrack(id);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 删除曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 搜索曲目
  ipcMain.handle('music:search-tracks', async (_event, query) => {
    try {
      const tracks = musicLibrary.searchTracks(query);
      return { success: true, data: tracks };
    } catch (e) {
      console.error('[IPC:音乐] 搜索曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 切换收藏
  ipcMain.handle('music:toggle-favorite', async (_event, id) => {
    try {
      const result = musicLibrary.toggleFavorite(id);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 切换收藏失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取收藏曲目
  ipcMain.handle('music:get-favorites', async () => {
    try {
      const tracks = musicLibrary.getFavorites();
      return { success: true, data: tracks };
    } catch (e) {
      console.error('[IPC:音乐] 获取收藏曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 更新曲目信息
  ipcMain.handle('music:update-track', async (_event, id, updates) => {
    try {
      const result = musicLibrary.updateTrack(id, updates);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 更新曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 读取音频文件元数据（不导入）
  ipcMain.handle('music:read-metadata', async (_event, filePath) => {
    try {
      const metadata = await musicLibrary.readMetadata(filePath);
      return { success: true, data: metadata };
    } catch (e) {
      console.error('[IPC:音乐] 读取元数据失败:', e);
      return { success: false, error: e.message };
    }
  });

  // ========== 歌单相关 IPC ==========

  // 创建歌单
  ipcMain.handle('music:create-playlist', async (_event, name, description) => {
    try {
      const playlist = musicLibrary.createPlaylist(name, description);
      return { success: true, data: playlist };
    } catch (e) {
      console.error('[IPC:音乐] 创建歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取所有歌单
  ipcMain.handle('music:get-all-playlists', async () => {
    try {
      const playlists = musicLibrary.getAllPlaylists();
      return { success: true, data: playlists };
    } catch (e) {
      console.error('[IPC:音乐] 获取所有歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取单个歌单
  ipcMain.handle('music:get-playlist', async (_event, id) => {
    try {
      const playlist = musicLibrary.getPlaylist(id);
      return { success: true, data: playlist };
    } catch (e) {
      console.error('[IPC:音乐] 获取歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 更新歌单
  ipcMain.handle('music:update-playlist', async (_event, id, updates) => {
    try {
      const result = musicLibrary.updatePlaylist(id, updates);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 更新歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 删除歌单
  ipcMain.handle('music:delete-playlist', async (_event, id) => {
    try {
      const result = musicLibrary.deletePlaylist(id);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 删除歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 添加曲目到歌单
  ipcMain.handle('music:add-track-to-playlist', async (_event, playlistId, trackId) => {
    try {
      const result = musicLibrary.addTrackToPlaylist(playlistId, trackId);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 添加曲目到歌单失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 从歌单移除曲目
  ipcMain.handle('music:remove-track-from-playlist', async (_event, playlistId, trackId) => {
    try {
      const result = musicLibrary.removeTrackFromPlaylist(playlistId, trackId);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 从歌单移除曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取歌单中的曲目
  ipcMain.handle('music:get-playlist-tracks', async (_event, playlistId) => {
    try {
      const tracks = musicLibrary.getPlaylistTracks(playlistId);
      return { success: true, data: tracks };
    } catch (e) {
      console.error('[IPC:音乐] 获取歌单曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 重新排序歌单曲目
  ipcMain.handle('music:reorder-playlist-tracks', async (_event, playlistId, trackIds) => {
    try {
      const result = musicLibrary.reorderPlaylistTracks(playlistId, trackIds);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 重新排序歌单曲目失败:', e);
      return { success: false, error: e.message };
    }
  });

  // ========== 播放历史统计 IPC ==========

  // 记录播放事件
  ipcMain.handle('music:record-play', async (_event, params) => {
    try {
      const {
        trackId, trackTitle, trackArtist, trackAlbum,
        source, durationPlayed, totalDuration, playSessionId,
      } = params;
      const result = musicLibrary.recordPlay(
        trackId, trackTitle, trackArtist, trackAlbum,
        source, durationPlayed, totalDuration, playSessionId
      );
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 记录播放事件失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取播放统计数据
  ipcMain.handle('music:get-play-stats', async (_event, options) => {
    try {
      const stats = musicLibrary.getPlayStats(options || {});
      return { success: true, data: stats };
    } catch (e) {
      console.error('[IPC:音乐] 获取播放统计失败:', e);
      return { success: false, error: e.message };
    }
  });

  // ============================================================
  // 多源音乐搜索（聚合搜索）
  // ============================================================

  // 聚合搜索 - 从多个平台搜索音乐
  ipcMain.handle('music:aggregate-search', async (_event, options, cookie?) => {
    try {
      const result = await multiSourceMusic.aggregateSearch(options, cookie);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC:音乐] 聚合搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - 网易云
  ipcMain.handle('music:search-netease', async (_event, keyword, limit?, cookie?) => {
    try {
      const songs = await multiSourceMusic.searchNetease(keyword, limit || 10, cookie);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] 网易云搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - QQ音乐
  ipcMain.handle('music:search-qq', async (_event, keyword, limit?) => {
    try {
      const songs = await multiSourceMusic.searchQQ(keyword, limit || 10);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] QQ音乐搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - 酷狗音乐
  ipcMain.handle('music:search-kugou', async (_event, keyword, limit?) => {
    try {
      const songs = await multiSourceMusic.searchKugou(keyword, limit || 10);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] 酷狗搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - 咪咕音乐
  ipcMain.handle('music:search-migu', async (_event, keyword, limit?) => {
    try {
      const songs = await multiSourceMusic.searchMigu(keyword, limit || 10);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] 咪咕搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - 百度音乐
  ipcMain.handle('music:search-baidu', async (_event, keyword, limit?) => {
    try {
      const songs = await multiSourceMusic.searchBaidu(keyword, limit || 10);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] 百度搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 单平台搜索 - 酷我音乐
  ipcMain.handle('music:search-kuwo', async (_event, keyword, limit?) => {
    try {
      const songs = await multiSourceMusic.searchKuwo(keyword, limit || 10);
      return { success: true, data: songs };
    } catch (e) {
      console.error('[IPC:音乐] 酷我搜索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取多源歌曲播放链接
  ipcMain.handle('music:get-multi-source-url', async (_event, song, cookie?) => {
    try {
      const url = await multiSourceMusic.getSongPlayUrl(song, cookie);
      return { success: true, data: url };
    } catch (e) {
      console.error('[IPC:音乐] 获取播放链接失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 获取多源歌曲歌词
  ipcMain.handle('music:get-multi-source-lyric', async (_event, song) => {
    try {
      const lyric = await multiSourceMusic.getSongLyric(song);
      return { success: true, data: lyric };
    } catch (e) {
      console.error('[IPC:音乐] 获取歌词失败:', e);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] 音乐库处理器注册完成');
}

module.exports = { registerMusicHandlers };

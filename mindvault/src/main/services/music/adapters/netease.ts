// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const netease = require('NeteaseCloudMusicApi');

let currentCookie = '';

const neteaseAdapter = createAdapter({
  name: 'netease',
  displayName: '网易云音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const params = {
        keywords: keyword,
        limit,
        offset: (page - 1) * limit,
      };
      if (currentCookie) {
        params.cookie = currentCookie;
      }

      const result = await netease.cloudsearch(params);
      const resultData = result?.body?.result || {};
      const list = resultData.songs || [];
      const total = resultData.songCount || 0;

      const songs = list.map(item => {
        const artist = (item.ar || item.artists || []).map(a => a.name).join(' / ');
        const album = item.al?.name || item.album?.name || '';
        const picUrl = item.al?.picUrl || item.album?.picUrl || '';
        return {
          id: `netease_${item.id}`,
          source: 'netease',
          songId: String(item.id),
          name: item.name,
          singer: artist,
          album,
          coverUrl: picUrl,
          duration: item.dt ? Math.round(item.dt / 1000) : 0,
          pay: item.fee || 0,
        };
      });

      return { songs, total };
    } catch (e) {
      console.error('[NeteaseAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songId, quality) {
    const levels = quality ? [quality] : ['hires', 'lossless', 'exhigh', 'higher', 'standard'];

    for (const level of levels) {
      try {
        let result;
        try {
          result = await netease.song_url({ id: Number(songId), level });
        } catch {
          try {
            result = await netease.song_url_v1({ id: Number(songId), level });
          } catch {
            continue;
          }
        }

        const data = result?.body?.data?.[0];
        if (data && data.url) {
          const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(data.url)}&referer=${encodeURIComponent('https://music.163.com/')}`;
          return { success: true, url: proxyUrl, quality: level };
        }
      } catch (e) {
        console.warn(`[NeteaseAdapter] getSongUrl level=${level} failed:`, e.message);
      }
    }

    return { success: false, url: null, error: '所有音质尝试均失败' };
  },

  async getLyric(songId) {
    try {
      const result = await netease.lyric({ id: Number(songId), cookie: currentCookie });
      const lrc = result?.body?.lrc?.lyric || '';
      const tlyric = result?.body?.tlyric?.lyric || '';
      return { success: true, lrc, tlyric };
    } catch (e) {
      console.error('[NeteaseAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songId) {
    try {
      const result = await netease.song_detail({ ids: String(songId), cookie: currentCookie });
      const song = result?.body?.songs?.[0];
      if (!song) return null;

      const artist = (song.ar || []).map(a => a.name).join(' / ');
      return {
        id: String(song.id),
        title: song.name,
        artist,
        album: song.al?.name || '',
        duration: song.dt ? Math.round(song.dt / 1000) : 0,
        coverUrl: song.al?.picUrl || '',
      };
    } catch (e) {
      console.error('[NeteaseAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    return {
      authenticated: !!currentCookie,
      user: null,
      platform: 'netease',
    };
  },

  setAuth(cookie) {
    currentCookie = cookie || '';
  },
});

module.exports = neteaseAdapter;

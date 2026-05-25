// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const qqMusic = require('qq-music-api');

let qqCookie = '';

const qqAdapter = createAdapter({
  name: 'qq',
  displayName: 'QQ音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const data = await qqMusic.api('search', { key: keyword, t: 0, pageNo: page, pageSize: limit });
      const list = data?.list || [];
      const songs = list.map(item => ({
        id: `qq_${item.songmid}`,
        source: 'qq',
        songId: item.songmid,
        songmid: item.songmid,
        songid: item.songid,
        name: item.songname,
        singer: (item.singer || []).map(s => s.name).join(' / '),
        album: item.albumname || '',
        albummid: item.albummid || '',
        coverUrl: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : '',
        duration: item.interval || 0,
        pay: 0,
      }));
      return { songs, total: data?.total || songs.length };
    } catch (e) {
      console.error('[QQAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songmid, quality) {
    try {
      const qualityMap = { '128k': '128', '320k': '320', standard: '128', higher: '320', exhigh: '320', lossless: 'flac', flac: 'flac', hires: 'flac' };
      const q = qualityMap[quality] || quality || '320';
      const qualityFallbacks = [q, '320', '128'];

      for (const fq of qualityFallbacks) {
        try {
          const data = await qqMusic.api('song/url', { id: songmid, type: fq });
          if (data && data[songmid]) {
            const url = data[songmid];
            if (url && !url.includes('mid_error') && !url.includes('数字专辑') && !url.includes('无版权')) {
              return { success: true, url, quality: fq };
            }
          }
        } catch {
          continue;
        }
      }
      return { success: false, url: null, error: 'QQ音乐获取播放URL失败' };
    } catch (e) {
      console.error('[QQAdapter] getSongUrl error:', e.message);
      return { success: false, url: null, error: e.message };
    }
  },

  async getLyric(songmid) {
    try {
      const data = await qqMusic.api('lyric', { id: songmid });
      return { success: true, lrc: data?.lyric || '', tlyric: data?.trans || '' };
    } catch (e) {
      console.error('[QQAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songmid) {
    try {
      const data = await qqMusic.api('song', { id: songmid });
      if (!data) return null;
      const info = Array.isArray(data) ? data[0] : data;
      return {
        id: songmid,
        title: info?.name || info?.songname || '',
        artist: (info?.singer || []).map(s => s.name).join(' / '),
        album: info?.albumname || '',
        duration: info?.interval || 0,
        coverUrl: info?.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${info.albummid}.jpg` : '',
      };
    } catch (e) {
      console.error('[QQAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    let uin = '';
    try { uin = qqMusic.uin || ''; } catch {}
    return {
      authenticated: !!qqCookie && !!uin,
      user: uin ? { uin } : null,
      platform: 'qq',
    };
  },

  setAuth(cookie) {
    qqCookie = cookie || '';
    try {
      qqMusic.setCookie(cookie);
    } catch (e) {
      console.error('[QQAdapter] setAuth error:', e.message);
    }
  },
});

module.exports = qqAdapter;

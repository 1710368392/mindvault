// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const { DEFAULT_HEADERS, request, checkUrlAvailable } = require('../http-util');

const KUWO_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://m.kuwo.cn',
  'Cookie': 'Hm_lvt_cdb524f42f0ce19b169a8071123a4797=1700000000; Hm_lpvt_cdb524f42f0ce19b169a8071123a4797=1700000000',
};

const kuwoAdapter = createAdapter({
  name: 'kuwo',
  displayName: '酷我音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}&pn=${page - 1}&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.1&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`;
      const data = await request(url, { headers: KUWO_HEADERS });

      const list = data?.abslist || [];

      const songs = list.map(item => {
        const durationParts = (item.DURATION || '00:00').split(':');
        const duration = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
        const musicId = item.MUSICRID?.replace('MUSIC_', '') || item.SONGID || '';

        return {
          id: `kuwo_${musicId}`,
          source: 'kuwo',
          songId: musicId,
          musicId: item.MUSICRID,
          name: item.NAME || item.SONGNAME || '',
          singer: item.ARTIST || item.SINGER || '',
          album: item.ALBUM || '',
          duration,
          coverUrl: item.web_albumpic_short?.includes('http')
            ? item.web_albumpic_short
            : item.web_albumpic_short
              ? `http://img1.kuwo.cn/star/albumcover/${item.web_albumpic_short}`
              : '',
          pay: parseInt(item.pay) || 0,
        };
      });

      return { songs, total: data?.TOTAL || songs.length };
    } catch (e) {
      console.error('[KuwoAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songId, quality) {
    try {
      const rid = songId.startsWith('MUSIC_') ? songId : `MUSIC_${songId}`;

      const brList = quality === 'lossless' ? ['320kmp3', '128kmp3'] : ['320kmp3', '128kmp3'];

      for (const br of brList) {
        const url = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=${rid}&br=${br}`;
        const data = await request(url, { headers: KUWO_HEADERS });

        if (data && typeof data === 'string' && data.startsWith('http')) {
          const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(data.trim())}&referer=${encodeURIComponent('http://m.kuwo.cn/')}`;
          return { success: true, url: proxyUrl, quality: br.includes('320') ? '320k' : '128k' };
        }

        if (data?.url) {
          const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(data.url)}&referer=${encodeURIComponent('http://m.kuwo.cn/')}`;
          return { success: true, url: proxyUrl, quality: br.includes('320') ? '320k' : '128k' };
        }
      }

      return { success: false, url: null, error: '酷我音乐获取播放URL失败' };
    } catch (e) {
      console.error('[KuwoAdapter] getSongUrl error:', e.message);
      return { success: false, url: null, error: e.message };
    }
  },

  async getLyric(songId) {
    try {
      const rid = songId.startsWith('MUSIC_') ? songId : `MUSIC_${songId}`;
      const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${rid.replace('MUSIC_', '')}`;
      const data = await request(url, { headers: KUWO_HEADERS });

      if (data?.data?.lrclist && Array.isArray(data.data.lrclist)) {
        const lrcContent = data.data.lrclist.map(line => {
          const time = parseFloat(line.time);
          const minutes = Math.floor(time / 60);
          const seconds = Math.floor(time % 60);
          const ms = Math.floor((time % 1) * 100);
          const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
          return `${timeStr}${line.lineLyric}`;
        }).join('\n');

        return { success: true, lrc: lrcContent, tlyric: '' };
      }

      return { success: false, lrc: '', tlyric: '' };
    } catch (e) {
      console.error('[KuwoAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songId) {
    try {
      const rid = songId.startsWith('MUSIC_') ? songId.replace('MUSIC_', '') : songId;
      const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${rid}`;
      const data = await request(url, { headers: KUWO_HEADERS });

      if (!data?.data?.songinfo) return null;

      const info = data.data.songinfo;
      return {
        id: songId,
        title: info.name || info.songName || '',
        artist: info.artist || info.singer || '',
        album: info.album || '',
        duration: info.duration ? Math.round(parseInt(info.duration)) : 0,
        coverUrl: info.pic || info.albumpic || '',
      };
    } catch (e) {
      console.error('[KuwoAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    return { authenticated: false, user: null, platform: 'kuwo' };
  },

  setAuth() {},
});

module.exports = kuwoAdapter;

// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const { DEFAULT_HEADERS, request, checkUrlAvailable } = require('../http-util');

const MIGU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://music.migu.cn/',
};

const miguAdapter = createAdapter({
  name: 'migu',
  displayName: '咪咕音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const params = {
        ua: 'Android_migu',
        version: '5.0.1',
        text: keyword,
        pageNo: String(page),
        pageSize: String(limit),
        searchSwitch: '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":1}',
      };
      const queryStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      const url = `http://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do?${queryStr}`;
      const data = await request(url, { headers: MIGU_HEADERS });
      const list = data?.songResultData?.result || [];

      const songs = list.map(item => {
        const singers = (item.singers || []).map(s => s.name).join('、');
        const coverUrl = item.imgItems?.[0]?.img || '';

        const rateFormats = (item.rateFormats || []).sort((a, b) =>
          parseInt(b.size || '0') - parseInt(a.size || '0')
        );

        return {
          id: `migu_${item.id || item.contentId}`,
          source: 'migu',
          songId: item.contentId || item.id,
          name: item.name || '',
          singer: singers,
          album: item.albums?.[0]?.name || '',
          duration: 0,
          coverUrl,
          contentId: item.contentId,
          rateFormats,
        };
      });

      return { songs, total: data?.songResultData?.totalCount || songs.length };
    } catch (e) {
      console.error('[MiguAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songId, quality) {
    try {
      const contentId = songId;
      const toneFlags = quality === 'lossless'
        ? ['SQ', 'HQ', 'PQ']
        : ['HQ', 'SQ', 'PQ'];

      for (const toneFlag of toneFlags) {
        const url = `http://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=${toneFlag}&netType=00&userId=15548614588710179085069&ua=Android_migu&version=5.1&copyrightId=0&contentId=${contentId}&resourceType=E&channel=0`;

        const checkResult = await checkUrlAvailable(url, { timeout: 5000 });
        if (checkResult.available) {
          const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(url)}&referer=${encodeURIComponent('http://music.migu.cn/')}`;
          return { success: true, url: proxyUrl, quality: toneFlag };
        }
      }

      const defaultUrl = `http://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=SQ&netType=00&userId=15548614588710179085069&ua=Android_migu&version=5.1&copyrightId=0&contentId=${contentId}&resourceType=E&channel=0`;
      const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(defaultUrl)}&referer=${encodeURIComponent('http://music.migu.cn/')}`;
      return { success: true, url: proxyUrl, quality: 'SQ' };
    } catch (e) {
      console.error('[MiguAdapter] getSongUrl error:', e.message);
      return { success: false, url: null, error: e.message };
    }
  },

  async getLyric(songId) {
    try {
      const url = `http://music.migu.cn/webapi/v1/music/playInfo?contentId=${songId}&resourceType=2`;
      const data = await request(url, { headers: MIGU_HEADERS });

      if (data?.data?.lrcUrl) {
        const lrcContent = await request(data.data.lrcUrl, { headers: MIGU_HEADERS });
        if (typeof lrcContent === 'string' && lrcContent.length > 0) {
          return { success: true, lrc: lrcContent, tlyric: '' };
        }
      }

      return { success: false, lrc: '', tlyric: '' };
    } catch (e) {
      console.error('[MiguAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songId) {
    try {
      const url = `http://music.migu.cn/webapi/v1/music/playInfo?contentId=${songId}&resourceType=2`;
      const data = await request(url, { headers: MIGU_HEADERS });

      if (!data?.data) return null;

      const info = data.data;
      return {
        id: songId,
        title: info.songName || '',
        artist: info.singerName || '',
        album: info.albumName || '',
        duration: info.length ? Math.round(parseInt(info.length)) : 0,
        coverUrl: info.cover || '',
      };
    } catch (e) {
      console.error('[MiguAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    return { authenticated: false, user: null, platform: 'migu' };
  },

  setAuth() {},
});

module.exports = miguAdapter;

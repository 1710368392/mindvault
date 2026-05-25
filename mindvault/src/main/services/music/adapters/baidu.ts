// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const { DEFAULT_HEADERS, request } = require('../http-util');

const BAIDU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://music.baidu.com/',
};

const baiduAdapter = createAdapter({
  name: 'baidu',
  displayName: '百度音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const url = `http://musicapi.qianqian.com/v1/restserver/ting?query=${encodeURIComponent(keyword)}&method=baidu.ting.search.common&format=json&page_no=${page}&page_size=${limit}`;
      const data = await request(url, { headers: BAIDU_HEADERS });
      const list = data?.song_list || [];

      const songs = [];

      for (const item of list) {
        try {
          const detailUrl = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&bit=320&songid=${item.song_id}`;
          const detailData = await request(detailUrl, { headers: BAIDU_HEADERS });

          if (!detailData?.bitrate?.file_link) continue;

          songs.push({
            id: `baidu_${item.song_id}`,
            source: 'baidu',
            songId: item.song_id,
            name: (item.title || '').replace(/<\/?em>/g, ''),
            singer: (item.author || '').replace(/<\/?em>/g, ''),
            album: (item.album_title || '').replace(/<\/?em>/g, ''),
            duration: detailData.bitrate?.file_duration || 0,
            coverUrl: detailData.songinfo?.pic_radio || '',
            songUrl: detailData.bitrate?.file_link,
            rate: detailData.bitrate?.file_bitrate || 128,
            ext: detailData.bitrate?.file_extension || 'mp3',
          });
        } catch {
          continue;
        }
      }

      return { songs, total: songs.length };
    } catch (e) {
      console.error('[BaiduAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songId, quality) {
    try {
      const bit = quality === 'lossless' ? '999' : '320';
      const url = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&bit=${bit}&songid=${songId}`;
      const data = await request(url, { headers: BAIDU_HEADERS });

      if (data?.bitrate?.file_link) {
        const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(data.bitrate.file_link)}&referer=${encodeURIComponent('http://music.baidu.com/')}`;
        return { success: true, url: proxyUrl, quality: String(data.bitrate.file_bitrate || bit) };
      }

      if (bit !== '128') {
        const fallbackUrl = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&bit=128&songid=${songId}`;
        const fallbackData = await request(fallbackUrl, { headers: BAIDU_HEADERS });

        if (fallbackData?.bitrate?.file_link) {
          const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(fallbackData.bitrate.file_link)}&referer=${encodeURIComponent('http://music.baidu.com/')}`;
          return { success: true, url: proxyUrl, quality: '128' };
        }
      }

      return { success: false, url: null, error: '百度音乐获取播放URL失败' };
    } catch (e) {
      console.error('[BaiduAdapter] getSongUrl error:', e.message);
      return { success: false, url: null, error: e.message };
    }
  },

  async getLyric(songId) {
    try {
      const url = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.lry&songid=${songId}`;
      const data = await request(url, { headers: BAIDU_HEADERS });

      if (data?.lrcContent) {
        return { success: true, lrc: data.lrcContent, tlyric: '' };
      }

      if (data?.lrcText) {
        return { success: true, lrc: data.lrcText, tlyric: '' };
      }

      return { success: false, lrc: '', tlyric: '' };
    } catch (e) {
      console.error('[BaiduAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songId) {
    try {
      const url = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&bit=320&songid=${songId}`;
      const data = await request(url, { headers: BAIDU_HEADERS });

      if (!data?.songinfo) return null;

      const info = data.songinfo;
      return {
        id: songId,
        title: info.title || '',
        artist: info.author || '',
        album: info.album_title || '',
        duration: data.bitrate?.file_duration ? Math.round(parseInt(data.bitrate.file_duration)) : 0,
        coverUrl: info.pic_radio || info.pic_big || info.pic_small || '',
      };
    } catch (e) {
      console.error('[BaiduAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    return { authenticated: false, user: null, platform: 'baidu' };
  },

  setAuth() {},
});

module.exports = baiduAdapter;

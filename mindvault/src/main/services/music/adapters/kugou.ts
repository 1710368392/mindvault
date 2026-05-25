// @ts-nocheck

const { createAdapter } = require('../source-adapter');
const { DEFAULT_HEADERS, request, checkUrlAvailable } = require('../http-util');

const KUGOU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://m.kugou.com',
};

const kugouAdapter = createAdapter({
  name: 'kugou',
  displayName: '酷狗音乐',

  async search(keyword, page = 1, limit = 30) {
    try {
      const url = `http://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&platform=WebFilter&format=json&page=${page}&pagesize=${limit}`;
      const data = await request(url, { headers: KUGOU_HEADERS });
      const list = data?.data?.lists || [];

      const songs = list.map(item => {
        let hash = item.FileHash;
        if (item.SQFileHash && item.SQFileHash !== '00000000000000000000000000000000') {
          hash = item.SQFileHash;
        } else if (item.HQFileHash && item.HQFileHash !== '00000000000000000000000000000000') {
          hash = item.HQFileHash;
        }

        return {
          id: `kugou_${item.Scid || item.FileHash}`,
          source: 'kugou',
          songId: item.Scid || item.FileHash,
          name: item.SongName || '',
          singer: item.SingerName || '',
          album: item.AlbumName || '',
          duration: item.Duration || 0,
          coverUrl: item.AlbumImg ? item.AlbumImg.replace('{size}', '150') : '',
          hash,
        };
      });

      return { songs, total: data?.data?.total || songs.length };
    } catch (e) {
      console.error('[KugouAdapter] search error:', e.message);
      return { songs: [], total: 0 };
    }
  },

  async getSongUrl(songId, quality) {
    try {
      const hash = songId;
      const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
      const data = await request(url, { headers: KUGOU_HEADERS });

      if (data && data.url) {
        const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(data.url)}&referer=${encodeURIComponent('http://m.kugou.com/')}`;
        return { success: true, url: proxyUrl, quality: quality || 'standard' };
      }

      return { success: false, url: null, error: '酷狗音乐获取播放URL失败' };
    } catch (e) {
      console.error('[KugouAdapter] getSongUrl error:', e.message);
      return { success: false, url: null, error: e.message };
    }
  },

  async getLyric(songId) {
    try {
      const hash = songId;
      const searchUrl = `http://krcs.kugou.com/search?ver=1&client=mobi&duration=&hash=${hash}&album_audio_id=`;
      const searchData = await request(searchUrl, { headers: KUGOU_HEADERS });

      if (!searchData?.candidates?.length) {
        return { success: false, lrc: '', tlyric: '' };
      }

      const candidate = searchData.candidates[0];
      const lrcUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${candidate.id}&accesskey=${candidate.accesskey}&fmt=lrc&charset=utf8`;
      const lrcData = await request(lrcUrl, { headers: KUGOU_HEADERS });

      if (lrcData?.content) {
        const content = Buffer.from(lrcData.content, 'base64').toString('utf-8');
        return { success: true, lrc: content, tlyric: '' };
      }

      return { success: false, lrc: '', tlyric: '' };
    } catch (e) {
      console.error('[KugouAdapter] getLyric error:', e.message);
      return { success: false, lrc: '', tlyric: '' };
    }
  },

  async getSongDetail(songId) {
    try {
      const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${songId}`;
      const data = await request(url, { headers: KUGOU_HEADERS });

      if (!data) return null;

      return {
        id: songId,
        title: data.songName || '',
        artist: data.singerName || '',
        album: data.albumName || '',
        duration: data.timeLength ? Math.round(data.timeLength) : 0,
        coverUrl: data.imgUrl || '',
      };
    } catch (e) {
      console.error('[KugouAdapter] getSongDetail error:', e.message);
      return null;
    }
  },

  checkAuthStatus() {
    return { authenticated: false, user: null, platform: 'kugou' };
  },

  setAuth() {},
});

module.exports = kugouAdapter;

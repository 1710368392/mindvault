// @ts-nocheck

const neteaseAdapter = require('./adapters/netease');
const qqAdapter = require('./adapters/qq');
const kugouAdapter = require('./adapters/kugou');
const kuwoAdapter = require('./adapters/kuwo');
const miguAdapter = require('./adapters/migu');
const baiduAdapter = require('./adapters/baidu');
const lxMusicApi = require('../Lx-music-api');

const adapters = {
  netease: neteaseAdapter,
  qq: qqAdapter,
  kugou: kugouAdapter,
  kuwo: kuwoAdapter,
  migu: miguAdapter,
  baidu: baiduAdapter,
};

function getAdapter(source) {
  return adapters[source] || null;
}

async function resolveSongUrl(song, options = {}) {
  const { quality, cookie, fallbackToLx = true, crossSource = true } = options;
  const source = song.source || 'netease';
  const songId = song.songId || song.songmid || song.id;
  const adapter = getAdapter(source);

  if (adapter) {
    const result = await adapter.getSongUrl(songId, quality);
    if (result.success) return result;
  }

  if (fallbackToLx) {
    const lxSourceMap = { netease: 'wy', qq: 'tx', kugou: 'kg', kuwo: 'kw', migu: 'mg' };
    const lxSource = lxSourceMap[source];
    if (lxSource) {
      try {
        const lxResult = await lxMusicApi.getSongUrlWithFallback(lxSource, songId, quality || '128k');
        if (lxResult.success) return lxResult;
      } catch (e) {
        console.warn('[UrlResolver] lx-music-api fallback failed:', e.message);
      }
    }
  }

  if (crossSource && (song.name || song.songName) && (song.singer || song.artist)) {
    try {
      const crossResult = await lxMusicApi.getSongUrlWithCrossSource(
        source === 'netease' ? 'wy' : source === 'qq' ? 'tx' : source,
        songId,
        quality || '128k',
        song.name || song.songName || song.title,
        song.singer || song.artist || '',
      );
      if (crossResult.success) return crossResult;
    } catch (e) {
      console.warn('[UrlResolver] cross-source failed:', e.message);
    }
  }

  return { success: false, url: null, error: '所有获取方式均失败' };
}

async function resolveLyric(song) {
  const source = song.source || 'netease';
  const songId = song.songId || song.songmid || song.id;
  const adapter = getAdapter(source);

  if (adapter) {
    const result = await adapter.getLyric(songId);
    if (result.success) return result;
  }

  try {
    const lxSourceMap = { netease: 'wy', qq: 'tx', kugou: 'kg', kuwo: 'kw', migu: 'mg' };
    const lxSource = lxSourceMap[source];
    if (lxSource) {
      const lxResult = await lxMusicApi.getLyric(lxSource, songId);
      if (lxResult?.success) return lxResult;
    }
  } catch {}

  return { success: false, lrc: '', tlyric: '' };
}

module.exports = {
  getAdapter,
  resolveSongUrl,
  resolveLyric,
  adapters,
};

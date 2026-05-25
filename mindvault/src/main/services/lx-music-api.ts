// @ts-nocheck
const net = require('net');
const fs = require('fs');
const path = require('path');

const DEFAULT_API_URL = 'http://127.0.0.1:8080';
const SUPPORTED_SOURCES = ['kw', 'kg', 'tx', 'wy', 'mg'];
const SOURCE_NAMES = {
  kw: '酷我音乐',
  kg: '酷狗音乐',
  tx: 'QQ音乐',
  wy: '网易云音乐',
  mg: '咪咕音乐',
};
const QUALITY_MAP = {
  '128k': '128k',
  '320k': '320k',
  flac: 'flac',
  flac24bit: 'flac24bit',
  hires: 'hires',
  standard: '128k',
  higher: '320k',
  exhigh: '320k',
  lossless: 'flac',
};

let apiUrl = DEFAULT_API_URL;

function setApiUrl(url) {
  apiUrl = url.replace(/\/+$/, '');
  console.log(`[LX-Music-API] API地址已设置为: ${apiUrl}`);
}

function getApiUrl() {
  return apiUrl;
}

async function checkStatus() {
  try {
    const resp = await fetch(apiUrl);
    const data = await resp.json();
    return { online: true, data };
  } catch (e) {
    return { online: false, error: e.message };
  }
}

async function getSongUrl(source, songId, quality = '128k') {
  if (!SUPPORTED_SOURCES.includes(source)) {
    throw new Error(`不支持的平台: ${source}, 支持的平台: ${SUPPORTED_SOURCES.join(', ')}`);
  }
  const mappedQuality = QUALITY_MAP[quality] || quality;
  const url = `${apiUrl}/url?source=${source}&songId=${encodeURIComponent(songId)}&quality=${mappedQuality}`;
  console.log(`[LX-Music-API] 获取播放URL: source=${source}, songId=${songId}, quality=${mappedQuality}`);
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.code === 200 && data.data && data.data.url) {
    return {
      success: true,
      url: data.data.url,
      quality: data.data.quality,
    };
  }
  return {
    success: false,
    error: data.message || `获取URL失败 (code: ${data.code})`,
    code: data.code,
  };
}

async function getSongInfo(source, songId) {
  if (!SUPPORTED_SOURCES.includes(source)) {
    throw new Error(`不支持的平台: ${source}`);
  }
  const url = `${apiUrl}/info?source=${source}&songId=${encodeURIComponent(songId)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.code === 200 && data.data) {
    return { success: true, data: data.data };
  }
  return { success: false, error: data.message || '获取歌曲信息失败' };
}

async function getLyric(source, songId) {
  if (!SUPPORTED_SOURCES.includes(source)) {
    throw new Error(`不支持的平台: ${source}`);
  }
  const url = `${apiUrl}/lyric?source=${source}&songId=${encodeURIComponent(songId)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.code === 200 && data.data) {
    return {
      success: true,
      lyric: data.data.lyric || '',
      trans: data.data.trans || '',
      roma: data.data.roma || '',
    };
  }
  return { success: false, error: data.message || '获取歌词失败' };
}

async function getSongUrlWithFallback(source, songId, quality = '128k') {
  const qualityFallbacks = [quality, '128k', '320k', 'flac'];
  const tried = new Set();
  for (const q of qualityFallbacks) {
    const mappedQ = QUALITY_MAP[q] || q;
    if (tried.has(mappedQ)) continue;
    tried.add(mappedQ);
    const result = await getSongUrl(source, songId, mappedQ);
    if (result.success) {
      return result;
    }
  }
  return { success: false, error: '所有音质尝试均失败' };
}

const KUWO_SEARCH_URL = 'http://search.kuwo.cn/r.s';
const KUWO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'http://www.kuwo.cn/',
  'Cookie': 'Hm_lvt_a4ee940b5f7f60a2e386e4457cf0145d=1; kw_token=12345',
};

async function searchKuwo(keyword, limit = 5) {
  try {
    const url = `${KUWO_SEARCH_URL}?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.1&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`;
    const resp = await fetch(url, { headers: KUWO_HEADERS });
    const data = await resp.json();
    const list = data?.abslist || [];
    return list.map(item => ({
      id: item.MUSICRID?.replace('MUSIC_', '') || item.SONGID || '',
      name: (item.NAME || item.SONGNAME || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      singer: (item.ARTIST || item.SINGER || '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'),
      duration: item.DURATION || '',
    }));
  } catch (e) {
    console.error('[LX-Music-API] 酷我搜索失败:', e.message);
    return [];
  }
}

function normalizeStr(s) {
  return (s || '').toLowerCase().replace(/[\s\-_··,.，。、:：;；!！?？()（）\[\]【】]/g, '').replace(/&nbsp;/g, '').replace(/&amp;/g, '&');
}

async function crossSourceSearch(songName, singer) {
  const keyword = `${singer} ${songName}`;
  console.log(`[LX-Music-API] 跨平台换源搜索: "${keyword}"`);
  const results = await searchKuwo(keyword, 10);
  if (results.length === 0) return null;
  const normName = normalizeStr(songName);
  const normSinger = normalizeStr(singer);
  for (const item of results) {
    const itemName = normalizeStr(item.name);
    const itemSinger = normalizeStr(item.singer);
    if (itemName.includes(normName) || normName.includes(itemName)) {
      if (normSinger && itemSinger && (itemSinger.includes(normSinger) || normSinger.includes(itemSinger))) {
        console.log(`[LX-Music-API] 换源匹配成功: 酷我 ${item.name} - ${item.singer} (id=${item.id})`);
        return { source: 'kw', songId: item.id, name: item.name, singer: item.singer };
      }
    }
  }
  if (results.length > 0) {
    const best = results[0];
    console.log(`[LX-Music-API] 换源模糊匹配: 酷我 ${best.name} - ${best.singer} (id=${best.id})`);
    return { source: 'kw', songId: best.id, name: best.name, singer: best.singer };
  }
  return null;
}

async function getSongUrlWithCrossSource(source, songId, quality, songName, singer) {
  const result = await getSongUrlWithFallback(source, songId, quality);
  if (result.success) return result;
  if (!songName) return result;
  console.log(`[LX-Music-API] ${SOURCE_NAMES[source] || source}获取失败，尝试跨平台换源...`);
  const crossResult = await crossSourceSearch(songName, singer);
  if (crossResult) {
    const crossUrl = await getSongUrlWithFallback(crossResult.source, crossResult.songId, quality);
    if (crossUrl.success) {
      crossUrl.crossSource = crossResult;
      return crossUrl;
    }
  }
  return result;
}

function parseCookieValue(cookieStr, name) {
  if (!cookieStr) return '';
  const match = cookieStr.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : '';
}

async function syncQQCredentials(cookieStr) {
  try {
    const uin = parseCookieValue(cookieStr, 'uin') || parseCookieValue(cookieStr, 'wxuin') || '';
    const token = parseCookieValue(cookieStr, 'qqmusic_key') || parseCookieValue(cookieStr, 'qm_keyst') || '';
    if (!uin || !token) {
      console.log('[LX-Music-API] QQ凭证不完整, uin:', uin ? '有' : '无', ', token:', token ? '有' : '无');
      return { success: false, error: '凭证不完整，需要 uin 和 qqmusic_key' };
    }
    const cleanUin = uin.replace(/^o/, '');
    const configPath = path.resolve(__dirname, '../../../../lx-music-api-server/data/config.json');
    if (!fs.existsSync(configPath)) {
      console.log('[LX-Music-API] 配置文件不存在:', configPath);
      return { success: false, error: 'lx-music-api-server 配置文件不存在' };
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.modules?.platform?.tx?.users) {
      config.modules = config.modules || {};
      config.modules.platform = config.modules.platform || {};
      config.modules.platform.tx = config.modules.platform.tx || {};
      config.modules.platform.tx.users = [];
    }
    config.modules.platform.tx.users = [{
      uin: cleanUin,
      token: token,
      refreshKey: '',
      openId: '',
      accessToken: '',
      refreshToken: '',
      vipType: '',
      refreshLogin: true,
    }];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[LX-Music-API] QQ凭证已同步到 lx-music-api-server (uin=${cleanUin})`);
    try {
      await fetch(`${apiUrl}/reload`, { method: 'POST' }).catch(() => {});
    } catch (e) {}
    return { success: true };
  } catch (e) {
    console.error('[LX-Music-API] 同步QQ凭证失败:', e);
    return { success: false, error: e.message };
  }
}

module.exports = {
  setApiUrl,
  getApiUrl,
  checkStatus,
  getSongUrl,
  getSongInfo,
  getLyric,
  getSongUrlWithFallback,
  getSongUrlWithCrossSource,
  crossSourceSearch,
  searchKuwo,
  syncQQCredentials,
  SUPPORTED_SOURCES,
  SOURCE_NAMES,
  DEFAULT_API_URL,
};

// @ts-nocheck
const qqMusic = require('qq-music-api');
const netease = require('NeteaseCloudMusicApi');

let qqCookie = '';
let neteaseCookie = '';

function setQQCookie(cookie) {
  qqCookie = cookie;
  try {
    qqMusic.setCookie(cookie);
    console.log('[MusicUnified] QQ Cookie 已设置, uin:', qqMusic.uin);
  } catch (e) {
    console.error('[MusicUnified] 设置QQ Cookie失败:', e.message);
  }
}

function getQQCookie() {
  return qqCookie;
}

function setNeteaseCookie(cookie) {
  neteaseCookie = cookie;
}

function getNeteaseCookie() {
  return neteaseCookie;
}

async function searchQQ(keyword, page = 1, limit = 30) {
  try {
    const data = await qqMusic.api('search', { key: keyword, t: 0, pageNo: page, pageSize: limit });
    const list = data?.list || [];
    return list.map(item => ({
      id: `qq-${item.songmid}`,
      originalId: item.songmid,
      songid: item.songid,
      name: item.songname,
      singer: (item.singer || []).map(s => s.name).join(' / '),
      album: item.albumname || '',
      albummid: item.albummid || '',
      duration: item.interval || 0,
      cover: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : '',
      source: 'qq',
    }));
  } catch (e) {
    console.error('[MusicUnified] QQ搜索失败:', e.message);
    return [];
  }
}

async function searchNetease(keyword, page = 1, limit = 30) {
  try {
    const params = { keywords: keyword, limit, offset: (page - 1) * limit };
    if (neteaseCookie) params.cookie = neteaseCookie;
    const res = await netease.cloudsearch(params);
    const list = res?.body?.result?.songs || [];
    return list.map(item => ({
      id: `netease-${item.id}`,
      originalId: item.id,
      name: item.name,
      singer: (item.ar || []).map(a => a.name).join(' / '),
      album: item.al?.name || '',
      duration: Math.floor((item.dt || 0) / 1000),
      cover: item.al?.picUrl || '',
      source: 'netease',
    }));
  } catch (e) {
    console.error('[MusicUnified] 网易云搜索失败:', e.message);
    return [];
  }
}

async function searchAll(keyword, page = 1, limit = 20) {
  const [qqResults, neteaseResults] = await Promise.allSettled([
    searchQQ(keyword, page, limit),
    searchNetease(keyword, page, limit),
  ]);
  const qq = qqResults.status === 'fulfilled' ? qqResults.value : [];
  const wy = neteaseResults.status === 'fulfilled' ? neteaseResults.value : [];
  const merged = [];
  let qi = 0, wi = 0;
  while (qi < qq.length || wi < wy.length) {
    if (qi < qq.length) { merged.push(qq[qi++]); }
    if (wi < wy.length) { merged.push(wy[wi++]); }
  }
  return merged;
}

async function getQQSongUrl(songmid, quality = '320') {
  try {
    const qualityMap = { '128k': '128', '320k': '320', standard: '128', higher: '320', exhigh: '320', lossless: 'flac', flac: 'flac', hires: 'flac' };
    const q = qualityMap[quality] || quality;
    const qualityFallbacks = [q, '320', '128'];
    for (const fq of qualityFallbacks) {
      try {
        const data = await qqMusic.api('song/url', { id: songmid, type: fq });
        if (data && data[songmid]) {
          const url = data[songmid];
          if (url && !url.includes('mid_error') && !url.includes('数字专辑') && !url.includes('无版权')) {
            console.log(`[MusicUnified] QQ播放URL获取成功: ${songmid}, 音质=${fq}`);
            return { success: true, url, quality: fq };
          }
        }
      } catch (e) {
        continue;
      }
    }
    return { success: false, error: 'QQ音乐获取播放URL失败，可能需要登录VIP账号' };
  } catch (e) {
    console.error('[MusicUnified] QQ获取URL异常:', e.message);
    return { success: false, error: e.message };
  }
}

async function getNeteaseSongUrl(songId, cookie) {
  try {
    const qualityPriority = ['hires', 'lossless', 'exhigh', 'higher', 'standard'];
    const useCookie = cookie || neteaseCookie;
    for (const level of qualityPriority) {
      try {
        const params = { id: songId, level };
        if (useCookie) params.cookie = useCookie;
        const res = await netease.song_url_v1(params);
        const url = res?.body?.data?.[0]?.url;
        if (url) {
          console.log(`[MusicUnified] 网易云播放URL获取成功: ${songId}, 音质=${level}`);
          return { success: true, url, quality: level };
        }
      } catch (e) {
        continue;
      }
    }
    try {
      const params = { id: songId };
      if (useCookie) params.cookie = useCookie;
      const res = await netease.song_url(params);
      const url = res?.body?.data?.[0]?.url;
      if (url) {
        return { success: true, url, quality: 'standard' };
      }
    } catch (e) {}
    return { success: false, error: '网易云获取播放URL失败' };
  } catch (e) {
    console.error('[MusicUnified] 网易云获取URL异常:', e.message);
    return { success: false, error: e.message };
  }
}

async function getQQLyric(songmid) {
  try {
    const data = await qqMusic.api('lyric', { id: songmid });
    return {
      success: true,
      lyric: data?.lyric || '',
      trans: data?.trans || '',
    };
  } catch (e) {
    console.error('[MusicUnified] QQ歌词获取失败:', e.message);
    return { success: false, error: e.message };
  }
}

async function getNeteaseLyric(songId, cookie) {
  try {
    const params = { id: songId };
    const useCookie = cookie || neteaseCookie;
    if (useCookie) params.cookie = useCookie;
    const res = await netease.lyric(params);
    return {
      success: true,
      lyric: res?.body?.lrc?.lyric || '',
      trans: res?.body?.tlyric?.lyric || '',
    };
  } catch (e) {
    console.error('[MusicUnified] 网易云歌词获取失败:', e.message);
    return { success: false, error: e.message };
  }
}

async function getQQTopList() {
  try {
    const data = await qqMusic.api('top/category', { showDetail: 1 });
    return { success: true, data: data?.list || [] };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getQQTopDetail(topId) {
  try {
    const data = await qqMusic.api('top', { id: topId });
    const list = data?.songList || data?.list || [];
    return {
      success: true,
      data: list.map(item => ({
        id: `qq-${item.songmid}`,
        originalId: item.songmid,
        songid: item.songid,
        name: item.songname,
        singer: (item.singer || []).map(s => s.name).join(' / '),
        album: item.albumname || '',
        albummid: item.albummid || '',
        duration: item.interval || 0,
        cover: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : '',
        source: 'qq',
      })),
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getQQSonglist(id) {
  try {
    const data = await qqMusic.api('songlist', { id });
    const songs = data?.songList || data?.tracks || [];
    return {
      success: true,
      data: {
        name: data?.dissname || data?.title || '',
        cover: data?.logo || data?.picurl || '',
        songs: songs.map(item => ({
          id: `qq-${item.songmid}`,
          originalId: item.songmid,
          songid: item.songid,
          name: item.songname,
          singer: (item.singer || []).map(s => s.name).join(' / '),
          album: item.albumname || '',
          albummid: item.albummid || '',
          duration: item.interval || 0,
          cover: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${item.albummid}.jpg` : '',
          source: 'qq',
        })),
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getQQSongDetail(songmid) {
  try {
    const data = await qqMusic.api('song', { id: songmid });
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function refreshQQLogin() {
  try {
    const data = await qqMusic.api('user/refresh');
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function getQQUserInfo() {
  try {
    console.log('[MusicUnified] 获取QQ用户信息 - qqMusic.uin:', qqMusic.uin);
    console.log('[MusicUnified] 获取QQ用户信息 - qqCookie:', qqCookie ? '有' : '无');
    
    // 尝试从cookie中解析uin
    let uin = qqMusic.uin;
    if (!uin && qqCookie) {
      const match = qqCookie.match(/(?:u|qqmusic_uin|uin)=(\d+)/i);
      if (match) {
        uin = match[1];
        console.log('[MusicUnified] 从cookie中解析到uin:', uin);
      }
    }
    
    if (!uin) {
      return { success: false, error: '未登录，无法获取用户信息' };
    }
    
    // 即使获取用户详情失败，也要返回基本信息
    let nickname = `QQ${uin}`;
    let avatarUrl = `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`;
    let vipType = 0;
    
    try {
      const data = await qqMusic.api('user/detail', { id: uin });
      console.log('[MusicUnified] qqMusic.api user/detail 结果:', JSON.stringify(data));
      if (data && data.data) {
        const profile = data.data;
        nickname = profile.nick || profile.hostname || nickname;
        if (profile.headpic) avatarUrl = profile.headpic;
        else if (profile.headpicurl) avatarUrl = profile.headpicurl;
        vipType = profile.isvip || 0;
      }
    } catch (detailErr) {
      console.warn('[MusicUnified] 获取QQ用户详情失败，但继续使用基本信息:', detailErr.message);
    }
    
    return {
      success: true,
      data: {
        userId: uin,
        nickname: nickname,
        avatarUrl: avatarUrl,
        vipType: vipType,
      },
    };
  } catch (e) {
    console.error('[MusicUnified] 获取QQ用户信息总失败:', e.message);
    // 尝试从cookie中解析uin，至少返回头像
    if (qqCookie) {
      const match = qqCookie.match(/(?:u|qqmusic_uin|uin)=(\d+)/i);
      if (match) {
        const uin = match[1];
        return {
          success: true,
          data: {
            userId: uin,
            nickname: `QQ${uin}`,
            avatarUrl: `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=640`,
            vipType: 0,
          },
        };
      }
    }
    return { success: false, error: e.message };
  }
}

module.exports = {
  setQQCookie,
  getQQCookie,
  setNeteaseCookie,
  getNeteaseCookie,
  searchQQ,
  searchNetease,
  searchAll,
  getQQSongUrl,
  getNeteaseSongUrl,
  getQQLyric,
  getNeteaseLyric,
  getQQTopList,
  getQQTopDetail,
  getQQSonglist,
  getQQSongDetail,
  refreshQQLogin,
  getQQUserInfo,
};

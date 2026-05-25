// @ts-nocheck
/**
 * 多源音乐服务
 * 移植自 music-dl (https://github.com/0xHJK/music-dl)
 * 支持网易云音乐、QQ音乐、酷狗音乐、咪咕音乐、百度音乐
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ============================================================
// 类型定义
// ============================================================

export interface MultiSourceSong {
  id: string;
  source: 'netease' | 'qq' | 'kugou' | 'migu' | 'baidu' | 'kuwo';
  name: string;
  singer: string;
  album: string;
  duration: number;
  coverUrl: string;
  songUrl?: string;
  rate?: number;
  size?: number;
  ext?: string;
  // 平台特有字段
  mid?: string;        // QQ音乐
  hash?: string;       // 酷狗音乐
  contentId?: string;  // 咪咕音乐
  musicId?: string;    // 酷我音乐
  pay?: number;        // 是否付费歌曲
}

export interface SearchOptions {
  keyword: string;
  sources?: ('netease' | 'qq' | 'kugou' | 'migu' | 'baidu' | 'kuwo')[];
  limit?: number;
}

export interface AggregateResult {
  songs: MultiSourceSong[];
  total: number;
  bySource: Record<string, number>;
}

// ============================================================
// HTTP 请求工具
// ============================================================

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
};

/**
 * 通用 HTTP 请求函数
 */
function request(url: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      timeout: options.timeout || 10000,
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            // 尝试解析 JSON
            if (data.startsWith('{') || data.startsWith('[')) {
              resolve(JSON.parse(data));
            } else {
              resolve(data);
            }
          } catch (e) {
            resolve(data);
          }
        } else if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // 处理重定向
          request(res.headers.location, options).then(resolve).catch(reject);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// ============================================================
// 链接验证缓存
// ============================================================

interface UrlCacheEntry {
  available: boolean;
  timestamp: number;
  contentType?: string;
  contentLength?: number;
}

const urlCache = new Map<string, UrlCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const MAX_CACHE_SIZE = 500; // 最大缓存条目数

/**
 * 获取缓存的验证结果
 */
function getCachedUrlCheck(url: string): UrlCacheEntry | null {
  const cached = urlCache.get(url);
  if (!cached) return null;
  
  // 检查缓存是否过期
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    urlCache.delete(url);
    return null;
  }
  
  return cached;
}

/**
 * 设置缓存的验证结果
 */
function setCachedUrlCheck(url: string, entry: UrlCacheEntry): void {
  // 如果缓存满了，删除最旧的条目
  if (urlCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = urlCache.keys().next().value;
    urlCache.delete(oldestKey);
  }
  
  urlCache.set(url, entry);
}

/**
 * 检查 URL 是否可用 - 多方法验证
 * 方法1: HEAD 请求
 * 方法2: GET 请求带 Range 头
 * 方法3: 检查 Content-Type
 */
async function checkUrlAvailable(url: string, options: { 
  checkContentType?: boolean;
  useCache?: boolean;
  timeout?: number;
} = {}): Promise<{ available: boolean; contentType?: string; contentLength?: number }> {
  const { checkContentType = true, useCache = true, timeout = 8000 } = options;
  
  // 检查缓存
  if (useCache) {
    const cached = getCachedUrlCheck(url);
    if (cached) {
      console.log(`[URLCheck] 缓存命中: ${url.substring(0, 50)}...`);
      return { 
        available: cached.available, 
        contentType: cached.contentType,
        contentLength: cached.contentLength
      };
    }
  }
  
  try {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // 方法1: 尝试 HEAD 请求
    const headResult = await new Promise<{ available: boolean; headers?: any }>((resolve) => {
      const req = client.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'HEAD',
        timeout: timeout,
        headers: {
          ...DEFAULT_HEADERS,
          'Range': 'bytes=0-1', // 尝试Range请求，某些服务器需要这个
        },
      }, (res) => {
        const success = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
        resolve({ available: success, headers: res.headers });
      });
      req.on('error', () => resolve({ available: false }));
      req.on('timeout', () => { req.destroy(); resolve({ available: false }); });
      req.end();
    });
    
    // 如果 HEAD 成功，检查 Content-Type
    if (headResult.available && checkContentType && headResult.headers) {
      const contentType = headResult.headers['content-type'] || '';
      const contentLength = parseInt(headResult.headers['content-length']) || 0;
      
      // 验证是否为音频文件
      const isAudio = contentType.includes('audio/') || 
                      contentType.includes('application/octet-stream') ||
                      contentType.includes('video/mp4'); // 某些平台返回这个
      
      // 验证文件大小是否合理（大于1KB）
      const isValidSize = contentLength === 0 || contentLength > 1024;
      
      const result = { 
        available: isAudio && isValidSize,
        contentType,
        contentLength
      };
      
      // 缓存结果
      if (useCache) {
        setCachedUrlCheck(url, { 
          available: result.available, 
          timestamp: Date.now(),
          contentType,
          contentLength
        });
      }
      
      return result;
    }
    
    // 方法2: 如果 HEAD 失败，尝试 GET 请求带 Range
    if (!headResult.available) {
      const rangeResult = await new Promise<{ available: boolean; headers?: any }>((resolve) => {
        const req = client.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          timeout: timeout,
          headers: {
            ...DEFAULT_HEADERS,
            'Range': 'bytes=0-1023', // 只请求前1KB
          },
        }, (res) => {
          const success = !!(res.statusCode && res.statusCode >= 200 && res.statusCode < 400);
          resolve({ available: success, headers: res.headers });
        });
        req.on('error', () => resolve({ available: false }));
        req.on('timeout', () => { req.destroy(); resolve({ available: false }); });
        req.end();
      });
      
      if (rangeResult.available && rangeResult.headers) {
        const contentType = rangeResult.headers['content-type'] || '';
        const contentLength = parseInt(rangeResult.headers['content-length']) || 
                             parseInt(rangeResult.headers['content-range']?.split('/')[1]) || 0;
        
        const result = { 
          available: true,
          contentType,
          contentLength
        };
        
        if (useCache) {
          setCachedUrlCheck(url, { 
            available: true, 
            timestamp: Date.now(),
            contentType,
            contentLength
          });
        }
        
        return result;
      }
    }
    
    // 缓存失败结果
    if (useCache) {
      setCachedUrlCheck(url, { 
        available: false, 
        timestamp: Date.now() 
      });
    }
    
    return { available: false };
  } catch (e) {
    console.error('[URLCheck] 验证失败:', e.message);
    return { available: false };
  }
}

/**
 * 批量验证 URL 可用性
 */
async function batchCheckUrlAvailable(urls: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  // 并行验证，但限制并发数
  const concurrency = 5;
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await checkUrlAvailable(url);
        return { url, available: result.available };
      })
    );
    
    batchResults.forEach(({ url, available }) => {
      results.set(url, available);
    });
  }
  
  return results;
}

// ============================================================
// 酷狗音乐
// ============================================================

const KUGOU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://m.kugou.com',
};

/**
 * 酷狗音乐搜索
 */
async function searchKugou(keyword: string, limit: number = 10): Promise<MultiSourceSong[]> {
  try {
    const url = `http://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&platform=WebFilter&format=json&page=1&pagesize=${limit}`;
    const data = await request(url, { headers: KUGOU_HEADERS });
    const list = data?.data?.lists || [];

    return list.map((item: any) => {
      // 优先选择高品质 hash
      let hash = item.FileHash;
      if (item.SQFileHash && item.SQFileHash !== '00000000000000000000000000000000') {
        hash = item.SQFileHash;
      } else if (item.HQFileHash && item.HQFileHash !== '00000000000000000000000000000000') {
        hash = item.HQFileHash;
      }

      return {
        id: item.Scid || item.FileHash,
        source: 'kugou' as const,
        name: item.SongName || '',
        singer: item.SingerName || '',
        album: item.AlbumName || '',
        duration: item.Duration || 0,
        coverUrl: item.AlbumImg ? item.AlbumImg.replace('{size}', '150') : '',
        size: Math.round((item.FileSize || 0) / 1048576 * 100) / 100,
        hash: hash,
      };
    });
  } catch (e) {
    console.error('[Kugou] 搜索失败:', e.message);
    return [];
  }
}

/**
 * 获取酷狗音乐播放链接
 */
async function getKugouSongUrl(hash: string): Promise<string | null> {
  try {
    const url = `http://m.kugou.com/app/i/getSongInfo.php?cmd=playInfo&hash=${hash}`;
    const data = await request(url, { headers: KUGOU_HEADERS });
    if (data && data.url) {
      return data.url;
    }
    return null;
  } catch (e) {
    console.error('[Kugou] 获取播放链接失败:', e.message);
    return null;
  }
}

/**
 * 获取酷狗音乐歌词
 */
async function getKugouLyric(hash: string): Promise<string> {
  try {
    // 先获取歌词 ID 和 accesskey
    const searchUrl = `http://krcs.kugou.com/search?ver=1&client=mobi&duration=&hash=${hash}&album_audio_id=`;
    const searchData = await request(searchUrl, { headers: KUGOU_HEADERS });
    
    if (!searchData?.candidates?.length) return '';
    
    const candidate = searchData.candidates[0];
    const id = candidate.id;
    const accesskey = candidate.accesskey;
    
    // 获取歌词内容
    const lrcUrl = `http://lyrics.kugou.com/download?ver=1&client=pc&id=${id}&accesskey=${accesskey}&fmt=lrc&charset=utf8`;
    const lrcData = await request(lrcUrl, { headers: KUGOU_HEADERS });
    
    if (lrcData?.content) {
      const content = Buffer.from(lrcData.content, 'base64').toString('utf-8');
      return content;
    }
    return '';
  } catch (e) {
    console.error('[Kugou] 获取歌词失败:', e.message);
    return '';
  }
}

// ============================================================
// QQ音乐
// ============================================================

const QQ_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'https://y.qq.com/portal/player.html',
};

/**
 * QQ音乐搜索
 */
async function searchQQ(keyword: string, limit: number = 10): Promise<MultiSourceSong[]> {
  try {
    const url = `http://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp?w=${encodeURIComponent(keyword)}&format=json&p=1&n=${limit}`;
    const data = await request(url, { headers: QQ_HEADERS });
    const list = data?.data?.song?.list || [];

    return list.map((item: any) => {
      const singers = (item.singer || []).map((s: any) => s.name).join('、');
      return {
        id: String(item.songid),
        source: 'qq' as const,
        name: item.songname || '',
        singer: singers,
        album: item.albumname || '',
        duration: item.interval || 0,
        coverUrl: item.albummid ? `https://y.gtimg.cn/music/photo_new/T002R150x150M000${item.albummid}.jpg` : '',
        size: Math.round((item.size128 || 0) / 1048576 * 100) / 100,
        mid: item.songmid,
      };
    });
  } catch (e) {
    console.error('[QQ] 搜索失败:', e.message);
    return [];
  }
}

/**
 * 获取QQ音乐播放链接
 */
async function getQQSongUrl(mid: string): Promise<string | null> {
  try {
    const guid = Math.floor(Math.random() * 9000000000) + 1000000000;
    
    // 音质优先级：无损 > 高品质 > 标准
    const rateList = [
      { prefix: 'F000', ext: 'flac', rate: 800 },  // 无损
      { prefix: 'M800', ext: 'mp3', rate: 320 },   // 高品质
      { prefix: 'C400', ext: 'm4a', rate: 128 },   // 标准
      { prefix: 'M500', ext: 'mp3', rate: 128 },   // 标准
    ];

    for (const rate of rateList) {
      const filename = `${rate.prefix}${mid}.${rate.ext}`;
      const params = {
        guid: String(guid),
        loginUin: '3051522991',
        format: 'json',
        platform: 'yqq',
        cid: '205361747',
        uin: '3051522991',
        songmid: mid,
        needNewCode: '0',
        filename: filename,
      };

      const queryStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
      const vkeyUrl = `https://c.y.qq.com/base/fcgi-bin/fcg_music_express_mobile3.fcg?${queryStr}`;
      const vkeyData = await request(vkeyUrl, { headers: { ...QQ_HEADERS, Referer: 'http://y.qq.com' } });
      
      const vkey = vkeyData?.data?.items?.[0]?.vkey;
      if (vkey) {
        const songUrl = `http://dl.stream.qqmusic.qq.com/${filename}?vkey=${vkey}&guid=${guid}&uin=3051522991&fromtag=64`;
        // 检查 URL 是否可用
        const checkResult = await checkUrlAvailable(songUrl);
        if (checkResult.available) {
          return songUrl;
        }
      }
    }
    return null;
  } catch (e) {
    console.error('[QQ] 获取播放链接失败:', e.message);
    return null;
  }
}

/**
 * 获取QQ音乐歌词
 */
async function getQQLyric(mid: string): Promise<string> {
  try {
    const params = {
      songmid: mid,
      loginUin: '0',
      hostUin: '0',
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: '0',
      platform: 'yqq.json',
      needNewCode: '0',
    };
    const queryStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
    const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?${queryStr}`;
    const data = await request(url, { headers: QQ_HEADERS });
    
    if (data?.lyric) {
      return Buffer.from(data.lyric, 'base64').toString('utf-8');
    }
    return '';
  } catch (e) {
    console.error('[QQ] 获取歌词失败:', e.message);
    return '';
  }
}

// ============================================================
// 咪咕音乐
// ============================================================

const MIGU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://music.migu.cn/',
};

/**
 * 咪咕音乐搜索
 */
async function searchMigu(keyword: string, limit: number = 10): Promise<MultiSourceSong[]> {
  try {
    const params = {
      ua: 'Android_migu',
      version: '5.0.1',
      text: keyword,
      pageNo: '1',
      pageSize: String(limit),
      searchSwitch: '{"song":1,"album":0,"singer":0,"tagSong":0,"mvSong":0,"songlist":0,"bestShow":1}',
    };
    const queryStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const url = `http://pd.musicapp.migu.cn/MIGUM2.0/v1.0/content/search_all.do?${queryStr}`;
    const data = await request(url, { headers: MIGU_HEADERS });
    const list = data?.songResultData?.result || [];

    return list.map((item: any) => {
      const singers = (item.singers || []).map((s: any) => s.name).join('、');
      const coverUrl = item.imgItems?.[0]?.img || '';
      
      // 按品质排序
      const rateFormats = (item.rateFormats || []).sort((a: any, b: any) => 
        parseInt(b.size || '0') - parseInt(a.size || '0')
      );

      return {
        id: item.id || '',
        source: 'migu' as const,
        name: item.name || '',
        singer: singers,
        album: item.albums?.[0]?.name || '',
        duration: 0,
        coverUrl: coverUrl,
        contentId: item.contentId,
        rateFormats: rateFormats,
      };
    });
  } catch (e) {
    console.error('[Migu] 搜索失败:', e.message);
    return [];
  }
}

/**
 * 获取咪咕音乐播放链接
 */
async function getMiguSongUrl(contentId: string, rateFormats?: any[]): Promise<string | null> {
  try {
    if (rateFormats && rateFormats.length > 0) {
      for (const rate of rateFormats) {
        const url = `http://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=${rate.formatType || 'SQ'}&netType=00&userId=15548614588710179085069&ua=Android_migu&version=5.1&copyrightId=0&contentId=${contentId}&resourceType=${rate.resourceType || 'E'}&channel=0`;
        const checkResult = await checkUrlAvailable(url);
        if (checkResult.available) {
          return url;
        }
      }
    }
    
    // 默认尝试高品质
    const defaultUrl = `http://app.pd.nf.migu.cn/MIGUM2.0/v1.0/content/sub/listenSong.do?toneFlag=SQ&netType=00&userId=15548614588710179085069&ua=Android_migu&version=5.1&copyrightId=0&contentId=${contentId}&resourceType=E&channel=0`;
    return defaultUrl;
  } catch (e) {
    console.error('[Migu] 获取播放链接失败:', e.message);
    return null;
  }
}

// ============================================================
// 酷我音乐
// ============================================================

const KUWO_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://m.kuwo.cn',
  'Cookie': 'Hm_lvt_cdb524f42f0ce19b169a8071123a4797=1700000000; Hm_lpvt_cdb524f42f0ce19b169a8071123a4797=1700000000',
};

/**
 * 酷我音乐搜索
 */
async function searchKuwo(keyword: string, limit: number = 10): Promise<MultiSourceSong[]> {
  try {
    // 使用酷我搜索API
    const url = `http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(keyword)}&pn=0&rn=${limit}&uid=0&ver=kwplayer_ar_9.2.2.1&vipver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1`;
    const data = await request(url, { headers: KUWO_HEADERS });
    
    const list = data?.abslist || [];

    return list.map((item: any) => {
      const durationParts = (item.DURATION || '00:00').split(':');
      const duration = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
      
      return {
        id: item.MUSICRID?.replace('MUSIC_', '') || item.SONGID || '',
        musicId: item.MUSICRID,
        source: 'kuwo' as const,
        name: item.NAME || item.SONGNAME || '',
        singer: item.ARTIST || item.SINGER || '',
        album: item.ALBUM || '',
        duration: duration,
        coverUrl: item.web_albumpic_short?.includes('http') 
          ? item.web_albumpic_short 
          : item.web_albumpic_short 
            ? `http://img1.kuwo.cn/star/albumcover/${item.web_albumpic_short}` 
            : '',
        pay: parseInt(item.pay) || 0,
      };
    });
  } catch (e) {
    console.error('[Kuwo] 搜索失败:', e.message);
    return [];
  }
}

/**
 * 获取酷我音乐播放链接
 */
async function getKuwoSongUrl(musicId: string): Promise<string | null> {
  try {
    // 确保使用正确的格式
    const rid = musicId.startsWith('MUSIC_') ? musicId : `MUSIC_${musicId}`;
    
    // 使用酷我反盗链服务获取播放链接
    const url = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=${rid}&br=320kmp3`;
    const data = await request(url, { headers: KUWO_HEADERS });
    
    if (data && typeof data === 'string' && data.startsWith('http')) {
      return data.trim();
    }
    
    // 备用方案：尝试其他音质
    const backupUrl = `https://antiserver.kuwo.cn/anti.s?type=convert_url3&rid=${rid}&br=128kmp3`;
    const backupData = await request(backupUrl, { headers: KUWO_HEADERS });
    
    if (backupData && typeof backupData === 'string' && backupData.startsWith('http')) {
      return backupData.trim();
    }
    
    return null;
  } catch (e) {
    console.error('[Kuwo] 获取播放链接失败:', e.message);
    return null;
  }
}

/**
 * 获取酷我音乐歌词
 */
async function getKuwoLyric(musicId: string): Promise<string> {
  try {
    const rid = musicId.startsWith('MUSIC_') ? musicId : `MUSIC_${musicId}`;
    const url = `http://m.kuwo.cn/newh5/singles/songinfoandlrc?musicId=${rid.replace('MUSIC_', '')}`;
    const data = await request(url, { headers: KUWO_HEADERS });
    
    if (data?.data?.lrclist && Array.isArray(data.data.lrclist)) {
      // 将JSON歌词转换为LRC格式
      const lrcList = data.data.lrclist;
      return lrcList.map((line: any) => {
        const time = parseFloat(line.time);
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 100);
        const timeStr = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
        return `${timeStr}${line.lineLyric}`;
      }).join('\n');
    }
    return '';
  } catch (e) {
    console.error('[Kuwo] 获取歌词失败:', e.message);
    return '';
  }
}

// ============================================================
// 百度音乐
// ============================================================

const BAIDU_HEADERS = {
  ...DEFAULT_HEADERS,
  'Referer': 'http://music.baidu.com/',
};

/**
 * 百度音乐搜索
 */
async function searchBaidu(keyword: string, limit: number = 10): Promise<MultiSourceSong[]> {
  try {
    const url = `http://musicapi.qianqian.com/v1/restserver/ting?query=${encodeURIComponent(keyword)}&method=baidu.ting.search.common&format=json&page_no=1&page_size=${limit}`;
    const data = await request(url, { headers: BAIDU_HEADERS });
    const list = data?.song_list || [];

    const songs: MultiSourceSong[] = [];
    
    for (const item of list) {
      try {
        // 获取歌曲详情（包含播放链接）
        const detailUrl = `http://tingapi.ting.baidu.com/v1/restserver/ting?method=baidu.ting.song.play&bit=320&songid=${item.song_id}`;
        const detailData = await request(detailUrl, { headers: BAIDU_HEADERS });
        
        if (!detailData?.bitrate?.file_link) continue;

        songs.push({
          id: item.song_id || '',
          source: 'baidu' as const,
          name: (item.title || '').replace(/<em>/g, '').replace(/<\/em>/g, ''),
          singer: (item.author || '').replace(/<em>/g, '').replace(/<\/em>/g, ''),
          album: (item.album_title || '').replace(/<em>/g, '').replace(/<\/em>/g, ''),
          duration: detailData.bitrate?.file_duration || 0,
          coverUrl: detailData.songinfo?.pic_radio || '',
          songUrl: detailData.bitrate?.file_link,
          rate: detailData.bitrate?.file_bitrate || 128,
          ext: detailData.bitrate?.file_extension || 'mp3',
        });
      } catch (e) {
        continue;
      }
    }

    return songs;
  } catch (e) {
    console.error('[Baidu] 搜索失败:', e.message);
    return [];
  }
}

// ============================================================
// 网易云音乐（使用现有 NeteaseCloudMusicApi）
// ============================================================

let neteaseApi: any = null;

/**
 * 初始化网易云 API
 */
function initNeteaseApi() {
  if (!neteaseApi) {
    try {
      neteaseApi = require('NeteaseCloudMusicApi');
    } catch (e) {
      console.warn('[MultiSource] NeteaseCloudMusicApi 未安装');
    }
  }
  return neteaseApi;
}

/**
 * 网易云音乐搜索
 */
async function searchNetease(keyword: string, limit: number = 10, cookie?: string): Promise<MultiSourceSong[]> {
  try {
    const api = initNeteaseApi();
    if (!api) return [];

    const params: any = {
      keywords: keyword,
      limit,
      offset: 0,
    };
    if (cookie) {
      params.cookie = cookie;
    }

    const result = await api.cloudsearch(params);
    const list = result?.body?.result?.songs || [];

    return list.map((item: any) => {
      const artist = (item.ar || item.artists || []).map((a: any) => a.name).join(' / ');
      const album = item.al?.name || item.album?.name || '';
      const picUrl = item.al?.picUrl || item.album?.picUrl || '';

      return {
        id: String(item.id),
        source: 'netease' as const,
        name: item.name || '',
        singer: artist,
        album: album,
        duration: item.dt ? Math.round(item.dt / 1000) : 0,
        coverUrl: picUrl,
        pay: item.fee || 0,
      };
    });
  } catch (e) {
    console.error('[Netease] 搜索失败:', e.message);
    return [];
  }
}

/**
 * 获取网易云音乐播放链接
 */
async function getNeteaseSongUrl(songId: string, cookie?: string): Promise<string | null> {
  try {
    const api = initNeteaseApi();
    if (!api) return null;

    const levels = ['hires', 'lossless', 'exhigh', 'higher', 'standard'];
    
    for (const level of levels) {
      const params: any = { id: Number(songId), level };
      if (cookie) {
        params.cookie = cookie;
      }

      try {
        const result = await api.song_url(params);
        const url = result?.body?.data?.[0]?.url;
        if (url) {
          return url;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (e) {
    console.error('[Netease] 获取播放链接失败:', e.message);
    return null;
  }
}

// ============================================================
// 聚合搜索
// ============================================================

/**
 * 聚合搜索 - 从多个平台搜索并合并结果
 * @param options 搜索选项
 * @param cookie 网易云 cookie（可选）
 */
async function aggregateSearch(options: SearchOptions, cookie?: string): Promise<AggregateResult> {
  const { keyword, sources = ['netease', 'qq', 'kugou', 'migu', 'baidu', 'kuwo'], limit = 10 } = options;
  
  console.log(`[MultiSource] 开始聚合搜索: "${keyword}", 平台: ${sources.join(', ')}`);

  // 并行搜索所有平台
  const searchPromises: Promise<MultiSourceSong[]>[] = [];

  if (sources.includes('netease')) {
    searchPromises.push(searchNetease(keyword, limit, cookie));
  }
  if (sources.includes('qq')) {
    searchPromises.push(searchQQ(keyword, limit));
  }
  if (sources.includes('kugou')) {
    searchPromises.push(searchKugou(keyword, limit));
  }
  if (sources.includes('migu')) {
    searchPromises.push(searchMigu(keyword, limit));
  }
  if (sources.includes('baidu')) {
    searchPromises.push(searchBaidu(keyword, limit));
  }
  if (sources.includes('kuwo')) {
    searchPromises.push(searchKuwo(keyword, limit));
  }

  // 等待所有搜索完成（使用 allSettled 避免单个平台失败影响整体）
  const results = await Promise.allSettled(searchPromises);

  // 合并所有结果
  let allSongs: MultiSourceSong[] = [];
  const bySource: Record<string, number> = {};

  results.forEach((result, index) => {
    const source = sources[index] || 'unknown';
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      const songs = result.value;
      bySource[source] = songs.length;
      allSongs = allSongs.concat(songs);
    } else {
      bySource[source] = 0;
      console.warn(`[MultiSource] ${source} 搜索失败:`, result.reason?.message || '未知错误');
    }
  });

  // 去重和排序
  allSongs = deduplicateAndSort(allSongs);

  console.log(`[MultiSource] 搜索完成: 共 ${allSongs.length} 首歌曲, 各平台: ${JSON.stringify(bySource)}`);

  return {
    songs: allSongs,
    total: allSongs.length,
    bySource,
  };
}

/**
 * 去重和排序
 * 相同歌手+歌名的歌曲只保留文件最大的版本
 */
function deduplicateAndSort(songs: MultiSourceSong[]): MultiSourceSong[] {
  const songMap = new Map<string, MultiSourceSong>();

  for (const song of songs) {
    // 生成唯一键：歌手+歌名（忽略大小写和空格）
    const key = `${song.singer.toLowerCase().replace(/\s/g, '')}_${song.name.toLowerCase().replace(/\s/g, '')}`;
    
    const existing = songMap.get(key);
    if (!existing) {
      songMap.set(key, song);
    } else {
      // 保留文件更大的版本
      const existingSize = existing.size || 0;
      const currentSize = song.size || 0;
      if (currentSize > existingSize) {
        songMap.set(key, song);
      }
    }
  }

  // 转换为数组并排序
  const result = Array.from(songMap.values());
  
  // 按歌手和歌名排序
  result.sort((a, b) => {
    const singerCompare = a.singer.localeCompare(b.singer, 'zh');
    if (singerCompare !== 0) return singerCompare;
    return a.name.localeCompare(b.name, 'zh');
  });

  return result;
}

/**
 * 获取歌曲播放链接
 */
async function getSongPlayUrl(song: MultiSourceSong, cookie?: string): Promise<string | null> {
  switch (song.source) {
    case 'netease':
      return getNeteaseSongUrl(song.id, cookie);
    case 'qq':
      return song.mid ? getQQSongUrl(song.mid) : null;
    case 'kugou':
      return song.hash ? getKugouSongUrl(song.hash) : null;
    case 'migu':
      return song.contentId ? getMiguSongUrl(song.contentId, (song as any).rateFormats) : null;
    case 'baidu':
      return song.songUrl || null;
    case 'kuwo':
      return song.musicId ? getKuwoSongUrl(song.musicId) : null;
    default:
      return null;
  }
}

/**
 * 获取歌曲歌词
 */
async function getSongLyric(song: MultiSourceSong): Promise<string> {
  switch (song.source) {
    case 'qq':
      return song.mid ? getQQLyric(song.mid) : '';
    case 'kugou':
      return song.hash ? getKugouLyric(song.hash) : '';
    case 'kuwo':
      return song.musicId ? getKuwoLyric(song.musicId) : '';
    default:
      return '';
  }
}

// ============================================================
// 导出
// ============================================================

module.exports = {
  // 聚合搜索
  aggregateSearch,
  // 单平台搜索
  searchNetease,
  searchQQ,
  searchKugou,
  searchMigu,
  searchBaidu,
  searchKuwo,
  // 获取播放链接
  getSongPlayUrl,
  getNeteaseSongUrl,
  getQQSongUrl,
  getKugouSongUrl,
  getMiguSongUrl,
  getKuwoSongUrl,
  // 获取歌词
  getSongLyric,
  getQQLyric,
  getKugouLyric,
  getKuwoLyric,
  // 链接验证
  checkUrlAvailable,
  batchCheckUrlAvailable,
  // 工具函数
  deduplicateAndSort,
};

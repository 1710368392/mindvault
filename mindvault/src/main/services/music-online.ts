// @ts-nocheck
/**
 * 在线音乐服务
 * 使用网易云音乐 API (NeteaseCloudMusicApi)
 * 音频通过 music-stream:// 协议代理，避免 CORS/Referer 问题
 */

const netease = require('NeteaseCloudMusicApi');
const { BrowserWindow, session, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const repo = require('../db/repository');

let currentCookie = '';

// ============================================================
// 音乐缓存管理
// ============================================================

/** 缓存目录 */
const CACHE_DIR = app ? path.join(app.getPath('userData'), 'music_cache') : path.join(__dirname, '../../music_cache');
/** 最大缓存大小：1GB */
const MAX_CACHE_SIZE = 1 * 1024 * 1024 * 1024;
/** 缓存元数据文件 */
const CACHE_META_FILE = path.join(CACHE_DIR, '.cache_meta.json');
/** 缓存元数据 */
let cacheMeta: Record<string, { size: number; accessedAt: number; songInfo?: any }> = {};
/** 正在下载的任务 */
const downloadingTasks = new Map<string, Promise<void>>();

/**
 * 初始化缓存目录
 */
function initCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      console.log('[MusicCache] 缓存目录已创建:', CACHE_DIR);
    }
    // 加载缓存元数据
    loadCacheMeta();
  } catch (e) {
    console.error('[MusicCache] 初始化缓存目录失败:', e.message);
  }
}

/**
 * 加载缓存元数据
 */
function loadCacheMeta() {
  try {
    if (fs.existsSync(CACHE_META_FILE)) {
      const data = fs.readFileSync(CACHE_META_FILE, 'utf-8');
      cacheMeta = JSON.parse(data);
    }
  } catch (e) {
    console.warn('[MusicCache] 加载缓存元数据失败:', e.message);
    cacheMeta = {};
  }
}

/**
 * 保存缓存元数据
 */
function saveCacheMeta() {
  try {
    fs.writeFileSync(CACHE_META_FILE, JSON.stringify(cacheMeta, null, 2));
  } catch (e) {
    console.warn('[MusicCache] 保存缓存元数据失败:', e.message);
  }
}

/**
 * 获取缓存文件路径
 */
function getCachePath(songId: string): string {
  return path.join(CACHE_DIR, `${songId}.mp3`);
}

/**
 * 检查歌曲是否已缓存
 */
function isSongCached(songId: string): boolean {
  const cachePath = getCachePath(songId);
  return fs.existsSync(cachePath);
}

/**
 * 获取缓存文件大小
 */
function getCacheSize(): number {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.mp3')) {
        const stat = fs.statSync(path.join(CACHE_DIR, file));
        totalSize += stat.size;
      }
    }
  } catch (e) {
    console.warn('[MusicCache] 计算缓存大小失败:', e.message);
  }
  return totalSize;
}

/**
 * LRU 清理策略：删除最久未访问的缓存文件
 */
async function cleanupCacheIfNeeded() {
  const currentSize = getCacheSize();
  if (currentSize <= MAX_CACHE_SIZE) return;

  console.log(`[MusicCache] 缓存大小 ${(currentSize / 1024 / 1024).toFixed(2)}MB 超过限制，开始清理...`);

  // 按访问时间排序
  const sortedEntries = Object.entries(cacheMeta)
    .filter(([songId]) => fs.existsSync(getCachePath(songId)))
    .sort((a, b) => (a[1].accessedAt || 0) - (b[1].accessedAt || 0));

  let freedSize = 0;
  const targetFree = currentSize - MAX_CACHE_SIZE * 0.8; // 清理到80%以下

  for (const [songId, meta] of sortedEntries) {
    if (freedSize >= targetFree) break;

    const cachePath = getCachePath(songId);
    try {
      const stat = fs.statSync(cachePath);
      fs.unlinkSync(cachePath);
      freedSize += stat.size;
      delete cacheMeta[songId];
      console.log(`[MusicCache] 已删除缓存: ${songId}`);
    } catch (e) {
      console.warn(`[MusicCache] 删除缓存失败 ${songId}:`, e.message);
    }
  }

  saveCacheMeta();
  console.log(`[MusicCache] 清理完成，释放 ${(freedSize / 1024 / 1024).toFixed(2)}MB`);
}

/**
 * 后台下载歌曲到缓存
 */
async function downloadToCache(songId: string, url: string, songInfo?: any): Promise<void> {
  // 如果已经在下载中，返回现有任务
  if (downloadingTasks.has(songId)) {
    return downloadingTasks.get(songId);
  }

  const cachePath = getCachePath(songId);

  // 如果已缓存，更新访问时间
  if (fs.existsSync(cachePath)) {
    cacheMeta[songId] = {
      ...cacheMeta[songId],
      accessedAt: Date.now(),
      songInfo,
    };
    saveCacheMeta();
    return;
  }

  // 创建下载任务
  const downloadTask = (async () => {
    try {
      console.log(`[MusicCache] 开始下载歌曲: ${songId}`);

      // 先清理缓存空间
      await cleanupCacheIfNeeded();

      // 下载文件
      const tempPath = `${cachePath}.tmp`;
      const result = await downloadFileToPath(url, tempPath, {
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      if (!result.success) {
        throw new Error(result.error || '下载失败');
      }

      // 移动到正式缓存路径
      fs.renameSync(tempPath, cachePath);

      // 更新元数据
      const stat = fs.statSync(cachePath);
      cacheMeta[songId] = {
        size: stat.size,
        accessedAt: Date.now(),
        songInfo,
      };
      saveCacheMeta();

      console.log(`[MusicCache] 歌曲下载完成: ${songId}, 大小: ${(stat.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (e) {
      console.error(`[MusicCache] 下载歌曲失败 ${songId}:`, e.message);
      // 清理临时文件
      try {
        const tempPath = `${cachePath}.tmp`;
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (_) {}
    } finally {
      downloadingTasks.delete(songId);
    }
  })();

  downloadingTasks.set(songId, downloadTask);
  return downloadTask;
}

/**
 * 下载文件到指定路径
 */
function downloadFileToPath(url: string, savePath: string, headers: Record<string, string> = {}): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers, timeout: 120000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFileToPath(res.headers.location, savePath, headers).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }

      const writeStream = fs.createWriteStream(savePath);
      res.pipe(writeStream);

      writeStream.on('finish', () => {
        writeStream.close();
        resolve({ success: true });
      });

      writeStream.on('error', (err) => {
        fs.unlink(savePath, () => {});
        resolve({ success: false, error: err.message });
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: '下载超时' });
    });
  });
}

// 初始化缓存目录
initCacheDir();

/**
 * 设置 cookie（用于 VIP 歌曲播放）
 */
function setCookie(cookie) {
  currentCookie = cookie;
  // 同步设置到 NeteaseCloudMusicApi
  if (cookie && netease.setCookie) {
    try {
      netease.setCookie(cookie);
    } catch (e) {
      console.warn('[MusicOnline] 设置 API cookie 失败:', e.message);
    }
  }
}

/**
 * 获取当前 cookie
 */
function getCookie() {
  return currentCookie;
}

/**
 * 搜索歌曲（网易云音乐）
 * 如果有 cookie 则携带登录态，可搜索到更多 VIP 歌曲
 */
async function searchSongs(keyword, page = 1, limit = 30) {
  try {
    const params = {
      keywords: keyword,
      limit,
      offset: (page - 1) * limit,
    };
    // 如果有 cookie，携带登录态
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
      const albumMid = item.al?.id || item.album?.id || '';
      const picUrl = item.al?.picUrl || item.album?.picUrl || '';
      return {
        id: String(item.id),
        songid: item.id,
        songmid: String(item.id),
        name: item.name,
        singer: artist,
        album,
        albummid: String(albumMid),
        coverUrl: picUrl,
        duration: item.dt ? Math.round(item.dt / 1000) : 0,
        strMediaMid: '',
        pay: item.fee || 0, // 0=free, 1=VIP, 8=free album
      };
    });

    return { songs, total };
  } catch (e) {
    console.error('[MusicOnline] search error:', e.message);
    return { songs: [], total: 0 };
  }
}

/**
 * 获取歌曲播放 URL（网易云音乐）
 * 返回 music-stream:// 代理 URL 或本地缓存文件路径
 *
 * VIP 播放修复 + 缓存策略：
 * 1. 首先检查本地缓存，如果存在直接返回缓存文件路径
 * 2. 如果不存在缓存，获取在线 URL 并启动后台下载
 * 3. 尝试多种音质级别和接口
 * 4. 确保 cookie 正确传递以获取 VIP 歌曲完整播放
 *
 * @param {string} songId - 歌曲ID
 * @param {object} songInfo - 歌曲信息（可选，用于缓存元数据）
 * @returns {Promise<string|null>} 播放 URL 或 null
 */
async function getSongUrl(songId, songInfo?) {
  // 1. 首先检查本地缓存
  if (isSongCached(songId)) {
    const cachePath = getCachePath(songId);
    // 更新访问时间
    if (cacheMeta[songId]) {
      cacheMeta[songId].accessedAt = Date.now();
      saveCacheMeta();
    }
    console.log(`[MusicOnline] 使用缓存播放: songId=${songId}, path=${cachePath}`);
    return `file://${cachePath}`;
  }

  // 2. 按优先级排列的音质级别列表
  const levels = ['hires', 'lossless', 'exhigh', 'higher', 'standard'];
  const levelNames = {
    hires: '无损音质',
    lossless: '高清音质',
    exhigh: '极高音质',
    higher: '较高音质',
    standard: '标准音质',
  };
  const errors = []; // 记录每个级别的错误信息

  for (const level of levels) {
    try {
      const params: any = {
        id: Number(songId),
      };

      // 尝试使用 song_url 接口
      let result;
      try {
        result = await (netease as any).song_url({ id: Number(songId), level });
      } catch (e1) {
        // song_url 失败，尝试 song_url_v1
        try {
          result = await (netease as any).song_url_v1({ id: Number(songId), level });
        } catch (e2) {
          // 两个接口都失败，记录错误
          errors.push(`接口失败: ${e1.message}, ${e2.message}`);
          continue;
        }
      }

      const data = result?.body?.data?.[0];
      if (data && data.url) {
        const originalUrl = data.url;

        // 3. 启动后台下载到缓存（不阻塞播放）
        if (songInfo) {
          downloadToCache(songId, originalUrl, songInfo).catch((e) => {
            console.warn(`[MusicOnline] 后台下载启动失败: songId=${songId}, error=${e.message}`);
          });
        }

        // 4. 返回流式 URL（通过代理）
        const proxyUrl = `music-stream://localhost?url=${encodeURIComponent(originalUrl)}&referer=${encodeURIComponent('https://music.163.com/')}`;
        console.log(`[MusicOnline] 获取播放链接成功: songId=${songId}, level=${level}(${levelNames[level]})`);
        return proxyUrl;
      }

      // 记录该级别无 URL 的原因
      const code = data?.code || 'unknown';
      const msg = `level=${level}(${levelNames[level]}), code=${code}`;
      errors.push(msg);
      console.warn(`[MusicOnline] 获取播放链接失败: songId=${songId}, ${msg}`);
    } catch (e) {
      const msg = `level=${level}(${levelNames[level]}), error=${e.message}`;
      errors.push(msg);
      console.warn(`[MusicOnline] 获取播放链接异常: songId=${songId}, ${msg}`);
    }
  }

  // 所有音质级别都尝试失败，返回 null
  console.error(`[MusicOnline] 所有音质级别均失败: songId=${songId}, 详情: ${errors.join('; ')}`);
  return null;
}

/**
 * 获取缓存统计信息
 * @returns {object} 缓存统计
 */
function getCacheStats() {
  const size = getCacheSize();
  const fileCount = Object.keys(cacheMeta).length;
  return {
    totalSize: size,
    totalSizeMB: (size / 1024 / 1024).toFixed(2),
    fileCount,
    maxSizeMB: (MAX_CACHE_SIZE / 1024 / 1024).toFixed(0),
    cacheDir: CACHE_DIR,
  };
}

/**
 * 清除所有缓存
 */
async function clearAllCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let deletedCount = 0;
    for (const file of files) {
      if (file.endsWith('.mp3')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
        deletedCount++;
      }
    }
    cacheMeta = {};
    saveCacheMeta();
    console.log(`[MusicCache] 已清除 ${deletedCount} 个缓存文件`);
    return { success: true, deletedCount };
  } catch (e) {
    console.error('[MusicCache] 清除缓存失败:', e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 获取歌词（网易云音乐）
 */
async function getLyric(songId) {
  try {
    const params = { id: Number(songId) };
    if (currentCookie) {
      params.cookie = currentCookie;
    }
    const result = await netease.lyric(params);
    const lrc = result?.body?.lrc?.lyric || '';
    const tlyric = result?.body?.tlyric?.lyric || '';
    return { lrc, tlyric };
  } catch (e) {
    console.error('[MusicOnline] getLyric error:', e.message);
    return { lrc: '', tlyric: '' };
  }
}

/**
 * 获取歌曲详情
 */
async function getSongDetail(songId) {
  try {
    const params = { ids: String(songId) };
    if (currentCookie) {
      params.cookie = currentCookie;
    }
    const result = await netease.song_detail(params);
    const songs = result?.body?.songs || [];
    if (songs.length === 0) return null;
    const s = songs[0];
    return {
      name: s.name,
      artist: (s.ar || []).map(a => a.name).join(' / '),
      album: s.al?.name || '',
      albumPic: s.al?.picUrl || '',
      duration: s.dt ? Math.round(s.dt / 1000) : 0,
    };
  } catch (e) {
    console.error('[MusicOnline] getSongDetail error:', e.message);
    return null;
  }
}

/**
 * 获取歌曲完整详情（用于侧边栏展示）
 * 返回更多详细信息，包括 pay、albumId、publishTime 等
 */
async function getSongFullDetail(songId) {
  try {
    const params = { ids: String(songId) };
    if (currentCookie) {
      params.cookie = currentCookie;
    }
    const result = await netease.song_detail(params);
    const songs = result?.body?.songs || [];
    if (songs.length === 0) return null;

    const s = songs[0];

    // 处理发布时间
    let publishTime = '';
    if (s.publishTime) {
      const date = new Date(s.publishTime);
      publishTime = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    return {
      id: String(s.id),
      name: s.name || '',
      singer: (s.ar || []).map(a => a.name).join(' / '),
      album: s.al?.name || '',
      albumId: s.al?.id ? String(s.al.id) : '',
      coverUrl: s.al?.picUrl || '',
      duration: s.dt ? Math.round(s.dt / 1000) : 0,
      pay: s.fee || 0,
      publishTime,
      // 附加信息
      artists: (s.ar || []).map(a => ({ id: String(a.id), name: a.name })),
      alias: s.alia || [],
    };
  } catch (e) {
    console.error('[MusicOnline] getSongFullDetail error:', e.message);
    return null;
  }
}

// ============================================================
// 网易云音乐登录功能
// ============================================================

let neteaseLoginWindow = null;
let neteaseLoginResolve = null;
let neteaseLoginResolved = false;

/**
 * 打开网易云音乐登录窗口
 * 用户在浏览器中登录后，监听 MUSIC_U cookie 来判断登录成功
 * @returns {Promise<string | null>} 登录成功返回 cookie，用户关闭窗口返回 null
 */
function loginNetease() {
  return new Promise(async (resolve) => {
    // 如果已有登录窗口，先关闭
    if (neteaseLoginWindow && !neteaseLoginWindow.isDestroyed()) {
      neteaseLoginWindow.close();
    }

    neteaseLoginResolve = resolve;
    neteaseLoginResolved = false;

    // 创建登录窗口
    neteaseLoginWindow = new BrowserWindow({
      width: 480,
      height: 680,
      title: '网易云音乐 - 登录',
      show: true,
      resizable: true,
      minimizable: true,
      maximizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    // 加载网易云音乐登录页
    neteaseLoginWindow.loadURL('https://music.163.com/');

    // 监听页面导航
    neteaseLoginWindow.webContents.on('did-navigate', async (_event, url) => {
      console.log('[NeteaseLogin] 页面导航:', url);
      await checkNeteaseLoginStatus();
    });

    neteaseLoginWindow.webContents.on('did-navigate-in-page', async (_event, url) => {
      console.log('[NeteaseLogin] 页面内导航:', url);
      await checkNeteaseLoginStatus();
    });

    // 监听 cookie 变化，检测 MUSIC_U 即为登录成功
    session.defaultSession.cookies.on('changed', async (_event, cookie, _cause) => {
      // 只关注网易云音乐域名的 cookie
      if (cookie.domain && cookie.domain.includes('music.163.com')) {
        console.log('[NeteaseLogin] cookie 变化:', cookie.name, '=', cookie.value ? cookie.value.substring(0, 10) + '...' : '(空)');
        // 延迟检查，等所有 cookie 写入完成
        setTimeout(() => checkNeteaseLoginStatus(), 1000);
      }
    });

    // 窗口关闭 = 用户取消
    neteaseLoginWindow.on('closed', () => {
      console.log('[NeteaseLogin] 登录窗口已关闭');
      neteaseLoginWindow = null;
      neteaseLoginResolved = true;
      const resolveFn = neteaseLoginResolve;
      neteaseLoginResolve = null;
      if (resolveFn) resolveFn(null);
    });
  });
}

/**
 * 检查网易云音乐登录状态（通过检测 MUSIC_U cookie）
 */
async function checkNeteaseLoginStatus() {
  if (!neteaseLoginResolve || neteaseLoginResolved) return;

  try {
    const cookies = await session.defaultSession.cookies.get({ domain: '.music.163.com' });

    // 检查是否有 MUSIC_U cookie（网易云音乐登录凭证）
    const musicU = cookies.find(c => c.name === 'MUSIC_U');

    if (musicU && musicU.value) {
      console.log('[NeteaseLogin] 检测到登录成功! MUSIC_U=', musicU.value.substring(0, 10) + '...');

      // 构建完整 cookie 字符串
      const cookieStr = cookies
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

      console.log('[NeteaseLogin] Cookie 长度:', cookieStr.length);

      // 先 resolve，再关闭窗口
      neteaseLoginResolved = true;
      const resolveFn = neteaseLoginResolve;
      neteaseLoginResolve = null;
      if (typeof resolveFn === 'function') {
        resolveFn(cookieStr);
      }

      // 关闭登录窗口
      if (neteaseLoginWindow && !neteaseLoginWindow.isDestroyed()) {
        neteaseLoginWindow.close();
      }
    }
  } catch (e) {
    console.warn('[NeteaseLogin] 检查登录状态异常:', e.message);
  }
}

/**
 * 获取网易云登录窗口状态
 */
function getNeteaseLoginStatus() {
  if (!neteaseLoginWindow || neteaseLoginWindow.isDestroyed()) return 'closed';
  return 'open';
}

/**
 * 关闭网易云登录窗口
 */
function closeNeteaseLoginWindow() {
  if (neteaseLoginWindow && !neteaseLoginWindow.isDestroyed()) {
    neteaseLoginWindow.close();
  }
  neteaseLoginWindow = null;
  neteaseLoginResolve = null;
}

// ============================================================
// 网易云用户信息与多账号管理（需求9）
// ============================================================

/** 账号信息结构 */
interface NeteaseAccount {
  userId: number;
  nickname: string;
  avatarUrl: string;
  vipType: number;
  cookie: string;
  savedAt: number;
}

/**
 * 获取网易云用户信息
 * 使用 netease.user_account 接口获取当前登录用户信息
 * @returns {Promise<{ userId, nickname, avatarUrl, vipType } | null>}
 */
async function getNeteaseUserInfo() {
  try {
    const params = {};
    if (currentCookie) {
      params.cookie = currentCookie;
    }
    const result = await netease.user_account(params);
    const account = result?.body?.account;
    const profile = result?.body?.profile;

    if (account && profile) {
      return {
        userId: account.id || profile.userId || 0,
        nickname: profile.nickname || '',
        avatarUrl: profile.avatarUrl || '',
        vipType: account.vipType || 0,
      };
    }
    return null;
  } catch (e) {
    console.error('[MusicOnline] 获取网易云用户信息失败:', e.message);
    return null;
  }
}

/**
 * 检查网易云登录状态
 * 使用 cookie 调用 login_status 接口验证登录是否有效
 * @returns {Promise<{ loggedIn: boolean, userId: number, nickname: string, avatarUrl: string }>}
 */
async function checkNeteaseLogin() {
  try {
    const params = {};
    if (currentCookie) {
      params.cookie = currentCookie;
    }
    const result = await netease.login_status(params);
    const data = result?.body?.data;

    if (data && data.account) {
      return {
        loggedIn: true,
        userId: data.account.id || 0,
        nickname: data.profile?.nickname || '',
        avatarUrl: data.profile?.avatarUrl || '',
      };
    }
    return { loggedIn: false, userId: 0, nickname: '', avatarUrl: '' };
  } catch (e) {
    console.error('[MusicOnline] 检查网易云登录状态失败:', e.message);
    return { loggedIn: false, userId: 0, nickname: '', avatarUrl: '' };
  }
}

/**
 * 保存账号信息到 settings 表
 * 键名格式：netease_accounts，存储 JSON 字符串（账号列表）
 * @param {string} platform - 平台标识（netease）
 * @param {object} accountInfo - 账号信息 { cookie, userId, nickname, avatarUrl }
 */
async function saveAccount(platform, accountInfo) {
  try {
    const settingsKey = `${platform}_accounts`;
    // 读取已有账号列表
    const existingRaw = getSetting(settingsKey);
    let accounts = [];
    if (existingRaw) {
      try {
        accounts = JSON.parse(existingRaw);
      } catch (_) {
        accounts = [];
      }
    }

    // 检查是否已存在该 userId 的账号，存在则更新
    const existIdx = accounts.findIndex(a => String(a.userId) === String(accountInfo.userId));
    const newAccount = {
      userId: accountInfo.userId,
      nickname: accountInfo.nickname || '',
      avatarUrl: accountInfo.avatarUrl || '',
      cookie: accountInfo.cookie || '',
      savedAt: Date.now(),
    };

    if (existIdx >= 0) {
      // 更新已有账号
      accounts[existIdx] = newAccount;
    } else {
      // 新增账号，放到列表最前面
      accounts.unshift(newAccount);
    }

    // 保存到 settings
    setSetting(settingsKey, JSON.stringify(accounts));
    console.log(`[MusicOnline] 账号已保存: ${platform}, userId=${accountInfo.userId}, nickname=${accountInfo.nickname}`);
    return true;
  } catch (e) {
    console.error('[MusicOnline] 保存账号失败:', e.message);
    return false;
  }
}

/**
 * 获取所有已保存的账号
 * @param {string} platform - 平台标识（netease）
 * @returns {Array} 账号列表
 */
function getSavedAccounts(platform) {
  try {
    const settingsKey = `${platform}_accounts`;
    const raw = getSetting(settingsKey);
    if (!raw) return [];
    const accounts = JSON.parse(raw);
    return Array.isArray(accounts) ? accounts : [];
  } catch (e) {
    console.error('[MusicOnline] 获取已保存账号失败:', e.message);
    return [];
  }
}

/**
 * 删除已保存的账号
 * @param {string} platform - 平台标识（netease）
 * @param {number} userId - 用户ID
 */
async function deleteAccount(platform, userId) {
  try {
    const settingsKey = `${platform}_accounts`;
    const raw = getSetting(settingsKey);
    if (!raw) return false;

    let accounts = JSON.parse(raw);
    accounts = accounts.filter(a => String(a.userId) !== String(userId));

    setSetting(settingsKey, JSON.stringify(accounts));
    console.log(`[MusicOnline] 账号已删除: ${platform}, userId=${userId}`);
    return true;
  } catch (e) {
    console.error('[MusicOnline] 删除账号失败:', e.message);
    return false;
  }
}

/**
 * 切换到指定账号（设置其 cookie 为当前活跃 cookie）
 * @param {string} platform - 平台标识
 * @param {number} userId - 用户ID
 * @returns {object | null} 切换后的账号信息，失败返回 null
 */
async function switchAccount(platform, userId) {
  try {
    const accounts = getSavedAccounts(platform);
    const account = accounts.find(a => String(a.userId) === String(userId));
    if (!account || !account.cookie) {
      console.warn('[MusicOnline] 切换账号失败：账号不存在或无 cookie');
      return null;
    }

    // 设置为当前活跃 cookie
    setCookie(account.cookie);
    // 同步保存到 qqMusicCookie（向后兼容）
    setSetting('qqMusicCookie', account.cookie);

    console.log(`[MusicOnline] 已切换到账号: userId=${userId}, nickname=${account.nickname}`);
    return {
      userId: account.userId,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl,
      cookie: account.cookie,
    };
  } catch (e) {
    console.error('[MusicOnline] 切换账号失败:', e.message);
    return null;
  }
}

/**
 * 登出当前账号（清除 cookie 和登录态）
 */
async function logoutNetease() {
  try {
    // 清除当前 cookie
    currentCookie = '';
    // 清除 NeteaseCloudMusicApi 的 cookie
    if (netease.setCookie) {
      try { netease.setCookie(''); } catch (_) {}
    }
    // 清除 Electron session 中的网易云 cookie
    try {
      const cookies = await session.defaultSession.cookies.get({ domain: '.music.163.com' });
      for (const c of cookies) {
        await session.defaultSession.cookies.remove('https://music.163.com', c.name);
      }
    } catch (_) {}
    // 清除 settings 中的 cookie
    setSetting('qqMusicCookie', '');
    console.log('[MusicOnline] 已登出网易云账号');
    return true;
  } catch (e) {
    console.error('[MusicOnline] 登出失败:', e.message);
    return false;
  }
}

// ============================================================
// 辅助函数：读写 settings 表
// ============================================================

/** 从 settings 表读取设置值 */
function getSetting(key) {
  try {
    if (repo.db) {
      const row = repo.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/** 写入 settings 表 */
function setSetting(key, value) {
  try {
    if (repo.db) {
      repo.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  } catch (e) {
    console.error('[MusicOnline] 保存设置失败:', e.message);
  }
}

// ============================================================
// 在线歌曲下载功能（需求10）
// ============================================================

/**
 * 清理文件名中的非法字符
 * @param {string} name - 原始文件名
 * @returns {string} 清理后的安全文件名
 */
function sanitizeFileName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * 通过 HTTP/HTTPS 下载文件（流式写入，避免内存溢出）
 * @param {string} url - 下载地址
 * @param {string} savePath - 保存路径
 * @param {object} headers - 请求头
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
function downloadFile(url, savePath, headers = {}) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers, timeout: 30000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, savePath, headers).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        resolve({ success: false, error: `HTTP ${res.statusCode}` });
        return;
      }

      const writeStream = fs.createWriteStream(savePath);
      res.pipe(writeStream);

      writeStream.on('finish', () => {
        writeStream.close();
        resolve({ success: true });
      });

      writeStream.on('error', (err) => {
        fs.unlink(savePath, () => {});
        resolve({ success: false, error: err.message });
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: '下载超时' });
    });
  });
}

/**
 * 下载在线歌曲到本地
 * 1. 获取播放 URL（原始 URL，非代理 URL）
 * 2. 直接下载到应用数据目录（无需用户选择）
 * 3. 下载音频文件和封面图片
 * 4. 自动导入到本地音乐库
 * @param {object} songInfo - 歌曲信息 { id, name, singer, coverUrl, duration }
 * @returns {Promise<{ success: boolean, filePath?: string, error?: string, track?: any }>}
 */
async function downloadSong(songInfo) {
  try {
    const { id, name, singer, coverUrl } = songInfo;

    // 1. 获取原始播放 URL（不走代理）
    const levels = ['exhigh', 'higher', 'standard'];
    let originalUrl = null;

    for (const level of levels) {
      try {
        const params = { id: Number(id), level };
        if (currentCookie) {
          params.cookie = currentCookie;
        }
        const result = await netease.song_url_v1(params);
        const data = result?.body?.data?.[0];
        if (data && data.url) {
          originalUrl = data.url;
          break;
        }
      } catch (_) {}
    }

    if (!originalUrl) {
      return { success: false, error: '无法获取下载链接，可能是 VIP 歌曲' };
    }

    // 2. 直接下载到应用数据目录
    const downloadPath = path.join(app.getPath('userData'), 'downloads');
    // 确保目录存在
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    // 3. 构建文件名
    const safeName = sanitizeFileName(name);
    const safeSinger = sanitizeFileName(singer);
    const fileName = `${safeSinger} - ${safeName}.mp3`;
    const filePath = path.join(downloadPath, fileName);

    // 4. 下载音频文件（添加正确的 Referer 和 User-Agent）
    console.log(`[MusicOnline] 开始下载歌曲: ${fileName}`);
    const downloadResult = await downloadFile(originalUrl, filePath, {
      'Referer': 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    if (!downloadResult.success) {
      return { success: false, error: `下载失败: ${downloadResult.error}` };
    }

    console.log(`[MusicOnline] 歌曲下载完成: ${filePath}`);

    // 5. 下载封面图片（如果存在）
    let coverSavePath = '';
    if (coverUrl) {
      try {
        const coverFileName = `${safeSinger} - ${safeName}.jpg`;
        coverSavePath = path.join(downloadPath, coverFileName);
        await downloadFile(coverUrl, coverSavePath, {
          'Referer': 'https://music.163.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });
        console.log(`[MusicOnline] 封面下载完成: ${coverSavePath}`);
      } catch (e) {
        console.warn('[MusicOnline] 封面下载失败:', e.message);
      }
    }

    // 6. 自动导入到本地音乐库
    let track = null;
    try {
      const musicLibrary = require('./music-library');
      track = await musicLibrary.importFile(filePath);
      if (track && coverSavePath && fs.existsSync(coverSavePath)) {
        // 更新封面 URL
        musicLibrary.updateTrack(track.id, { coverUrl: coverSavePath });
        track.coverUrl = coverSavePath;
      }
      console.log('[MusicOnline] 已自动导入到本地音乐库:', track?.id);
    } catch (e) {
      console.warn('[MusicOnline] 自动导入本地库失败:', e.message);
    }

    return { success: true, filePath, track };
  } catch (e) {
    console.error('[MusicOnline] 下载歌曲异常:', e.message);
    return { success: false, error: e.message };
  }
}

// ============================================================
// 榜单功能（需求8）
// ============================================================

/** 榜单缓存，避免频繁请求 */
let chartListCache = null;
let chartListCacheTime = 0;
const CHART_CACHE_DURATION = 10 * 60 * 1000; // 榜单缓存10分钟

/** 各榜单歌曲缓存 */
const chartSongsCache: Record<string, { data: any; time: number }> = {};
const CHART_SONGS_CACHE_DURATION = 10 * 60 * 1000; // 榜单歌曲缓存10分钟

/**
 * 获取榜单列表
 * 使用 netease.toplist 接口获取所有可用榜单
 */
async function getChartList() {
  try {
    // 检查缓存
    const now = Date.now();
    if (chartListCache && (now - chartListCacheTime) < CHART_CACHE_DURATION) {
      return chartListCache;
    }

    const params = {};
    if (currentCookie) {
      params.cookie = currentCookie;
    }

    const result = await netease.toplist(params);

    const list = result?.body?.list || [];
    const charts = list.map(item => ({
      id: String(item.id),
      name: item.name || '',
      coverUrl: item.coverImgUrl || item.picUrl || '',
      description: item.description || '',
      updateFrequency: item.updateFrequency || '',
      playCount: item.playCount || 0,
      trackCount: item.trackCount || 0,
    }));

    const data = { charts, total: charts.length };
    // 更新缓存
    chartListCache = data;
    chartListCacheTime = now;

    return data;
  } catch (e) {
    console.error('[MusicOnline] getChartList error:', e.message);
    return { charts: [], total: 0 };
  }
}

/**
 * 获取某个榜单的详细歌曲列表
 * 使用 netease.playlist_detail 接口获取榜单详情
 * @param {string} chartId - 榜单ID
 * @param {number} limit - 返回歌曲数量，默认5首
 */
async function getChartDetail(chartId, limit = 5) {
  try {
    // 检查缓存
    const now = Date.now();
    const cacheKey = `${chartId}_${limit}`;
    const cached = chartSongsCache[cacheKey];
    if (cached && (now - cached.time) < CHART_SONGS_CACHE_DURATION) {
      return cached.data;
    }

    const params = { id: Number(chartId) };
    if (currentCookie) {
      params.cookie = currentCookie;
    }

    const result = await netease.playlist_detail(params);

    const trackIds = result?.body?.playlist?.trackIds || [];
    const tracks = result?.body?.playlist?.tracks || [];

    // 优先使用 tracks 字段（已包含完整信息）
    let songs = [];
    if (tracks.length > 0) {
      songs = tracks.slice(0, limit).map(item => {
        const artist = (item.ar || []).map(a => a.name).join(' / ');
        const album = item.al?.name || '';
        const picUrl = item.al?.picUrl || '';
        return {
          id: String(item.id),
          name: item.name,
          singer: artist,
          album,
          coverUrl: picUrl,
          duration: item.dt ? Math.round(item.dt / 1000) : 0,
          pay: item.fee || 0,
        };
      });
    } else if (trackIds.length > 0) {
      // 只有 trackIds，需要获取详情
      const ids = trackIds.slice(0, limit).map(t => t.id);
      const detailParams = { ids: ids.join(',') };
      if (currentCookie) {
        detailParams.cookie = currentCookie;
      }
      const detailResult = await netease.song_detail(detailParams);
      const detailSongs = detailResult?.body?.songs || [];
      songs = detailSongs.map(item => {
        const artist = (item.ar || []).map(a => a.name).join(' / ');
        const album = item.al?.name || '';
        const picUrl = item.al?.picUrl || '';
        return {
          id: String(item.id),
          name: item.name,
          singer: artist,
          album,
          coverUrl: picUrl,
          duration: item.dt ? Math.round(item.dt / 1000) : 0,
          pay: item.fee || 0,
        };
      });
    }

    const data = { songs, total: songs.length };
    // 更新缓存
    chartSongsCache[cacheKey] = { data, time: now };

    return data;
  } catch (e) {
    console.error('[MusicOnline] getChartDetail error:', e.message);
    return { songs: [], total: 0 };
  }
}

module.exports = {
  setCookie,
  getCookie,
  searchSongs,
  getSongUrl,
  getLyric,
  getSongDetail,
  getSongFullDetail,
  // 网易云登录
  loginNetease,
  getNeteaseLoginStatus,
  closeNeteaseLoginWindow,
  // 网易云用户信息与账号管理（需求9）
  getNeteaseUserInfo,
  checkNeteaseLogin,
  saveAccount,
  getSavedAccounts,
  deleteAccount,
  switchAccount,
  logoutNetease,
  // 在线歌曲下载（需求10）
  downloadSong,
  // 榜单
  getChartList,
  getChartDetail,
  // VIP歌曲缓存播放（优化8）
  getCacheStats,
  clearAllCache,
  isSongCached: (songId: string) => isSongCached(songId),
  // settings 读写辅助函数
  setSetting,
  getSetting,
};

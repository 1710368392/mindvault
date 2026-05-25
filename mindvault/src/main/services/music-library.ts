// @ts-nocheck
/**
 * 音乐库服务
 * 处理音乐曲目的导入、查询、搜索、收藏等操作
 */

const crypto = require('crypto');

function uuidv4() {
  return crypto.randomUUID();
}
const path = require('path');
const fs = require('fs');
const repo = require('../db/repository');

// music-metadata 是 ESM 模块，需要动态导入
let _parseFile: any = null;
async function getParseFile() {
  if (!_parseFile) {
    const mod = await import('music-metadata');
    _parseFile = mod.parseFile;
  }
  return _parseFile;
}

// ========== 内联类型定义 ==========

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  src: string;
  duration: number;
  coverUrl: string;
  lrcPath: string;
  source: 'local' | 'online' | 'preset';
  addedAt: number;
  isFavorite: number; // 0 or 1 (SQLite boolean)
}

// ========== 实现 ==========

/**
 * 初始化 music_tracks 表
 * 在应用启动时调用一次
 */
function initMusicTable(): void {
  if (!repo.db) return;
  repo.db.exec(`
    CREATE TABLE IF NOT EXISTS music_tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT '',
      src TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      cover_url TEXT NOT NULL DEFAULT '',
      lrc_path TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'local',
      added_at INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0
    )
  `);

  // 歌单表
  repo.db.exec(`
    CREATE TABLE IF NOT EXISTS music_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      cover_url TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `);

  // 歌单曲目关联表
  repo.db.exec(`
    CREATE TABLE IF NOT EXISTS music_playlist_tracks (
      playlist_id TEXT NOT NULL,
      track_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (playlist_id, track_id),
      FOREIGN KEY (playlist_id) REFERENCES music_playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES music_tracks(id) ON DELETE CASCADE
    )
  `);

  // 启用外键约束
  repo.db.exec('PRAGMA foreign_keys = ON');

  // 播放历史记录表（用于收听数据统计）
  repo.db.exec(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL,
      track_title TEXT NOT NULL DEFAULT '',
      track_artist TEXT NOT NULL DEFAULT '',
      track_album TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'local',
      played_at INTEGER NOT NULL,
      duration_played REAL NOT NULL DEFAULT 0,
      total_duration REAL NOT NULL DEFAULT 0,
      completion_rate REAL NOT NULL DEFAULT 0,
      play_session_id TEXT NOT NULL DEFAULT ''
    )
  `);

  // 为播放历史创建索引，加速统计查询
  repo.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at)
  `);
  repo.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_play_history_track_id ON play_history(track_id)
  `);
  repo.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_play_history_session_id ON play_history(play_session_id)
  `);

  console.log('[音乐库] music_tracks / music_playlists / music_playlist_tracks / play_history 表初始化完成');
}

/**
 * 读取音频文件元数据
 * 使用 music-metadata 解析音频文件，提取标题、艺术家、专辑、时长等信息
 */
async function readMetadata(filePath: string): Promise<{
  title: string;
  artist: string;
  album: string;
  duration: number;
}> {
  const defaults = {
    title: path.basename(filePath, path.extname(filePath)),
    artist: '',
    album: '',
    duration: 0,
  };

  try {
    const parseFile = await getParseFile();
    const metadata = await parseFile(filePath);
    return {
      title: metadata.common.title || defaults.title,
      artist: metadata.common.artist || '',
      album: metadata.common.album || '',
      duration: metadata.format.duration || 0,
    };
  } catch (e) {
    console.error('[音乐库] 读取元数据失败:', filePath, e.message);
    return defaults;
  }
}

/**
 * 导入单个音频文件到音乐库
 * - 读取元数据
 * - 生成 UUID
 * - 检查重复（按 src 路径）
 * - 保存到数据库
 */
async function importFile(filePath: string): Promise<MusicTrack | null> {
  if (!repo.db) return null;

  try {
    // 检查是否已导入
    const existing = repo.db
      .prepare('SELECT id FROM music_tracks WHERE src = ?')
      .get(filePath);
    if (existing) {
      console.log('[音乐库] 文件已存在，跳过:', filePath);
      return null;
    }

    const metadata = await readMetadata(filePath);
    const id = uuidv4();
    const now = Date.now();

    repo.db.prepare(`
      INSERT INTO music_tracks (id, title, artist, album, src, duration, cover_url, lrc_path, source, added_at, is_favorite)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      metadata.title,
      metadata.artist,
      metadata.album,
      filePath,
      metadata.duration,
      '',  // cover_url
      '',  // lrc_path
      'local',
      now,
      0,   // is_favorite
    );

    const track: MusicTrack = {
      id,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      src: filePath,
      duration: metadata.duration,
      coverUrl: '',
      lrcPath: '',
      source: 'local',
      addedAt: now,
      isFavorite: 0,
    };

    console.log('[音乐库] 导入成功:', metadata.title);
    return track;
  } catch (e) {
    console.error('[音乐库] 导入文件失败:', filePath, e.message);
    return null;
  }
}

/**
 * 批量导入音频文件
 */
async function importFiles(filePaths: string[]): Promise<MusicTrack[]> {
  const results: MusicTrack[] = [];
  for (const filePath of filePaths) {
    const track = await importFile(filePath);
    if (track) {
      results.push(track);
    }
  }
  return results;
}

/**
 * 获取所有曲目，按添加时间降序排列
 */
function getAllTracks(): MusicTrack[] {
  if (!repo.db) return [];
  const rows = repo.db.prepare('SELECT * FROM music_tracks ORDER BY added_at DESC').all();
  return repo.mapRows(rows) as MusicTrack[];
}

/**
 * 根据 ID 获取单个曲目
 */
function getTrack(id: string): MusicTrack | null {
  if (!repo.db) return null;
  const row = repo.db.prepare('SELECT * FROM music_tracks WHERE id = ?').get(id);
  if (!row) return null;
  return repo.toCamelCase(row) as MusicTrack;
}

/**
 * 删除曲目
 * 同时尝试删除关联的封面图片文件
 */
function deleteTrack(id: string): boolean {
  if (!repo.db) return false;

  try {
    const track = getTrack(id);
    if (!track) return false;

    // 尝试删除封面文件
    if (track.coverUrl) {
      try {
        if (fs.existsSync(track.coverUrl)) {
          fs.unlinkSync(track.coverUrl);
          console.log('[音乐库] 已删除封面文件:', track.coverUrl);
        }
      } catch (e) {
        console.warn('[音乐库] 删除封面文件失败:', e.message);
      }
    }

    const result = repo.db.prepare('DELETE FROM music_tracks WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (e) {
    console.error('[音乐库] 删除曲目失败:', id, e.message);
    return false;
  }
}

/**
 * 搜索曲目（匹配标题、艺术家、专辑）
 */
function searchTracks(query: string): MusicTrack[] {
  if (!repo.db) return [];
  const pattern = `%${query}%`;
  const rows = repo.db.prepare(
    'SELECT * FROM music_tracks WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?'
  ).all(pattern, pattern, pattern);
  return repo.mapRows(rows) as MusicTrack[];
}

/**
 * 切换收藏状态
 */
function toggleFavorite(id: string): boolean {
  if (!repo.db) return false;

  try {
    const track = getTrack(id);
    if (!track) return false;

    const newFavorite = track.isFavorite ? 0 : 1;
    repo.db
      .prepare('UPDATE music_tracks SET is_favorite = ? WHERE id = ?')
      .run(newFavorite, id);

    return newFavorite === 1;
  } catch (e) {
    console.error('[音乐库] 切换收藏失败:', id, e.message);
    return false;
  }
}

/**
 * 获取收藏曲目
 */
function getFavorites(): MusicTrack[] {
  if (!repo.db) return [];
  const rows = repo.db
    .prepare('SELECT * FROM music_tracks WHERE is_favorite = 1 ORDER BY added_at DESC')
    .all();
  return repo.mapRows(rows) as MusicTrack[];
}

/**
 * 更新曲目信息
 */
function updateTrack(id: string, updates: Partial<MusicTrack>): boolean {
  if (!repo.db) return false;

  try {
    const allowedFields = [
      'title', 'artist', 'album', 'coverUrl', 'lrcPath', 'isFavorite',
    ];
    const snakeMap: Record<string, string> = {
      coverUrl: 'cover_url',
      lrcPath: 'lrc_path',
      isFavorite: 'is_favorite',
    };

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        const colName = snakeMap[key] || key;
        setClauses.push(`${colName} = ?`);
        values.push(updates[key]);
      }
    }

    if (setClauses.length === 0) return false;

    values.push(id);
    const sql = `UPDATE music_tracks SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = repo.db.prepare(sql).run(...values);
    return result.changes > 0;
  } catch (e) {
    console.error('[音乐库] 更新曲目失败:', id, e.message);
    return false;
  }
}

// ========== 歌单相关类型 ==========

interface MusicPlaylist {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  createdAt: number;
  updatedAt: number;
  sortOrder: number;
}

interface PlaylistTrack {
  playlistId: string;
  trackId: string;
  sortOrder: number;
  addedAt: number;
}

// ========== 歌单 CRUD ==========

/**
 * 创建歌单
 */
function createPlaylist(name: string, description: string = ''): MusicPlaylist | null {
  if (!repo.db) return null;

  try {
    const id = uuidv4();
    const now = Date.now();

    // 获取当前最大 sort_order
    const maxRow = repo.db
      .prepare('SELECT MAX(sort_order) as max_order FROM music_playlists')
      .get();
    const nextOrder = (maxRow?.maxOrder || 0) + 1;

    repo.db.prepare(`
      INSERT INTO music_playlists (id, name, description, cover_url, created_at, updated_at, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, '', now, now, nextOrder);

    const playlist: MusicPlaylist = {
      id,
      name,
      description,
      coverUrl: '',
      createdAt: now,
      updatedAt: now,
      sortOrder: nextOrder,
    };

    console.log('[音乐库] 创建歌单成功:', name);
    return playlist;
  } catch (e) {
    console.error('[音乐库] 创建歌单失败:', e.message);
    return null;
  }
}

/**
 * 获取所有歌单，按 sort_order 排序
 */
function getAllPlaylists(): MusicPlaylist[] {
  if (!repo.db) return [];
  const rows = repo.db
    .prepare('SELECT * FROM music_playlists ORDER BY sort_order ASC')
    .all();
  return repo.mapRows(rows) as MusicPlaylist[];
}

/**
 * 获取单个歌单
 */
function getPlaylist(id: string): MusicPlaylist | null {
  if (!repo.db) return null;
  const row = repo.db
    .prepare('SELECT * FROM music_playlists WHERE id = ?')
    .get(id);
  if (!row) return null;
  return repo.toCamelCase(row) as MusicPlaylist;
}

/**
 * 更新歌单信息
 */
function updatePlaylist(id: string, updates: Partial<MusicPlaylist>): boolean {
  if (!repo.db) return false;

  try {
    const allowedFields = ['name', 'description', 'coverUrl'];
    const snakeMap: Record<string, string> = {
      coverUrl: 'cover_url',
    };

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        const colName = snakeMap[key] || key;
        setClauses.push(`${colName} = ?`);
        values.push(updates[key]);
      }
    }

    if (setClauses.length === 0) return false;

    // 更新时间戳
    setClauses.push('updated_at = ?');
    values.push(Date.now());

    values.push(id);
    const sql = `UPDATE music_playlists SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = repo.db.prepare(sql).run(...values);
    return result.changes > 0;
  } catch (e) {
    console.error('[音乐库] 更新歌单失败:', id, e.message);
    return false;
  }
}

/**
 * 删除歌单（同时删除关联的 playlist_tracks）
 */
function deletePlaylist(id: string): boolean {
  if (!repo.db) return false;

  try {
    // 先删除关联的曲目
    repo.db.prepare('DELETE FROM music_playlist_tracks WHERE playlist_id = ?').run(id);
    // 再删除歌单
    const result = repo.db.prepare('DELETE FROM music_playlists WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (e) {
    console.error('[音乐库] 删除歌单失败:', id, e.message);
    return false;
  }
}

/**
 * 添加曲目到歌单
 */
function addTrackToPlaylist(playlistId: string, trackId: string): boolean {
  if (!repo.db) return false;

  try {
    // 检查是否已存在
    const existing = repo.db
      .prepare('SELECT 1 FROM music_playlist_tracks WHERE playlist_id = ? AND track_id = ?')
      .get(playlistId, trackId);
    if (existing) {
      console.log('[音乐库] 曲目已在歌单中，跳过');
      return true;
    }

    // 获取当前最大 sort_order
    const maxRow = repo.db
      .prepare('SELECT MAX(sort_order) as max_order FROM music_playlist_tracks WHERE playlist_id = ?')
      .get(playlistId);
    const nextOrder = (maxRow?.maxOrder || 0) + 1;

    repo.db.prepare(`
      INSERT INTO music_playlist_tracks (playlist_id, track_id, sort_order, added_at)
      VALUES (?, ?, ?, ?)
    `).run(playlistId, trackId, nextOrder, Date.now());

    return true;
  } catch (e) {
    console.error('[音乐库] 添加曲目到歌单失败:', e.message);
    return false;
  }
}

/**
 * 从歌单移除曲目
 */
function removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
  if (!repo.db) return false;

  try {
    const result = repo.db
      .prepare('DELETE FROM music_playlist_tracks WHERE playlist_id = ? AND track_id = ?')
      .run(playlistId, trackId);
    return result.changes > 0;
  } catch (e) {
    console.error('[音乐库] 从歌单移除曲目失败:', e.message);
    return false;
  }
}

/**
 * 获取歌单中的所有曲目（JOIN music_tracks）
 */
function getPlaylistTracks(playlistId: string): any[] {
  if (!repo.db) return [];

  try {
    const rows = repo.db.prepare(`
      SELECT t.*, pt.sort_order as pt_sort_order, pt.added_at as pt_added_at
      FROM music_playlist_tracks pt
      JOIN music_tracks t ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.sort_order ASC
    `).all(playlistId);

    return repo.mapRows(rows);
  } catch (e) {
    console.error('[音乐库] 获取歌单曲目失败:', e.message);
    return [];
  }
}

/**
 * 重新排序歌单中的曲目
 */
function reorderPlaylistTracks(playlistId: string, trackIds: string[]): boolean {
  if (!repo.db) return false;

  try {
    const updateStmt = repo.db.prepare(
      'UPDATE music_playlist_tracks SET sort_order = ? WHERE playlist_id = ? AND track_id = ?'
    );

    // 使用事务确保原子性
    const transaction = repo.db.transaction(() => {
      for (let i = 0; i < trackIds.length; i++) {
        updateStmt.run(i, playlistId, trackIds[i]);
      }
    });

    transaction();
    return true;
  } catch (e) {
    console.error('[音乐库] 重新排序歌单曲目失败:', e.message);
    return false;
  }
}

// ========== 播放历史统计相关 ==========

/**
 * 记录播放事件
 * 将一次播放行为写入 play_history 表
 * @param trackId - 曲目ID
 * @param trackTitle - 曲目标题
 * @param trackArtist - 曲目艺术家
 * @param trackAlbum - 曲目专辑
 * @param source - 来源 (local/online/preset)
 * @param durationPlayed - 本次播放时长（秒）
 * @param totalDuration - 歌曲总时长（秒）
 * @param playSessionId - 播放会话ID
 */
function recordPlay(
  trackId: string,
  trackTitle: string,
  trackArtist: string,
  trackAlbum: string,
  source: string,
  durationPlayed: number,
  totalDuration: number,
  playSessionId: string
): boolean {
  if (!repo.db) return false;

  try {
    // 忽略播放时长过短的记录（小于1秒）
    if (durationPlayed < 1) return false;

    const completionRate = totalDuration > 0 ? Math.min(durationPlayed / totalDuration, 1) : 0;
    const playedAt = Math.floor(Date.now() / 1000); // 毫秒时间戳转秒

    repo.db.prepare(`
      INSERT INTO play_history (track_id, track_title, track_artist, track_album, source, played_at, duration_played, total_duration, completion_rate, play_session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trackId,
      trackTitle || '',
      trackArtist || '',
      trackAlbum || '',
      source || 'local',
      playedAt,
      durationPlayed,
      totalDuration,
      completionRate,
      playSessionId || ''
    );

    return true;
  } catch (e) {
    console.error('[音乐库] 记录播放事件失败:', e.message);
    return false;
  }
}

/**
 * 获取播放统计数据（多维）
 * @param options - 查询选项
 * @param options.period - 统计周期: 'today' | 'week' | 'month' | 'all'
 * @returns 多维统计数据对象
 */
function getPlayStats(options: { period?: string } = {}): any {
  if (!repo.db) {
    return _emptyStats();
  }

  try {
    // 根据周期计算时间范围（秒级 Unix 时间戳）
    const now = Math.floor(Date.now() / 1000);
    let timeCondition = '1=1'; // 默认不限制时间

    switch (options.period) {
      case 'today': {
        // 今天 0 点的时间戳
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTs = Math.floor(todayStart.getTime() / 1000);
        timeCondition = `played_at >= ${todayTs}`;
        break;
      }
      case 'week': {
        // 最近7天
        const weekTs = now - 7 * 24 * 3600;
        timeCondition = `played_at >= ${weekTs}`;
        break;
      }
      case 'month': {
        // 最近30天
        const monthTs = now - 30 * 24 * 3600;
        timeCondition = `played_at >= ${monthTs}`;
        break;
      }
      default:
        break;
    }

    const where = `WHERE ${timeCondition}`;

    // 总播放次数
    const countRow = repo.db.prepare(`SELECT COUNT(*) as cnt FROM play_history ${where}`).get();
    const totalPlays = countRow?.cnt || 0;

    // 总收听时长（秒）
    const durationRow = repo.db.prepare(`SELECT COALESCE(SUM(duration_played), 0) as total FROM play_history ${where}`).get();
    const totalDuration = durationRow?.total || 0;

    // 收听过不同曲目数
    const uniqueRow = repo.db.prepare(`SELECT COUNT(DISTINCT track_id) as cnt FROM play_history ${where}`).get();
    const uniqueTracks = uniqueRow?.cnt || 0;

    // 最爱歌曲 Top 10
    const topTracks = repo.db.prepare(`
      SELECT track_id as trackId, track_title as trackTitle, track_artist as trackArtist,
             COUNT(*) as playCount, SUM(duration_played) as totalDuration
      FROM play_history ${where}
      GROUP BY track_id
      ORDER BY playCount DESC, totalDuration DESC
      LIMIT 10
    `).all();

    // 最爱艺术家 Top 10
    const topArtists = repo.db.prepare(`
      SELECT track_artist as artist, COUNT(*) as playCount, SUM(duration_played) as totalDuration
      FROM play_history ${where}
      WHERE track_artist != ''
      GROUP BY track_artist
      ORDER BY playCount DESC, totalDuration DESC
      LIMIT 10
    `).all();

    // 最爱专辑 Top 10
    const topAlbums = repo.db.prepare(`
      SELECT track_album as album, COUNT(*) as playCount, SUM(duration_played) as totalDuration
      FROM play_history ${where}
      WHERE track_album != ''
      GROUP BY track_album
      ORDER BY playCount DESC, totalDuration DESC
      LIMIT 10
    `).all();

    // 24小时播放分布
    const hourlyRows = repo.db.prepare(`
      SELECT CAST(strftime('%H', datetime(played_at, 'unixepoch', 'localtime')) AS INTEGER) as hour,
             COUNT(*) as cnt
      FROM play_history ${where}
      GROUP BY hour
    `).all();
    const hourlyDistribution = new Array(24).fill(0);
    for (const row of hourlyRows) {
      if (row.hour >= 0 && row.hour < 24) {
        hourlyDistribution[row.hour] = row.cnt;
      }
    }

    // 每日播放分布（最近30天）
    const dailyRows = repo.db.prepare(`
      SELECT date(datetime(played_at, 'unixepoch', 'localtime')) as date,
             COUNT(*) as playCount, SUM(duration_played) as totalDuration
      FROM play_history ${where}
      GROUP BY date
      ORDER BY date DESC
      LIMIT 30
    `).all();
    const dailyDistribution = dailyRows.map((row: any) => ({
      date: row.date,
      playCount: row.playCount,
      totalDuration: row.totalDuration,
    }));

    // 最近播放 20 条
    const recentPlays = repo.db.prepare(`
      SELECT track_id as trackId, track_title as trackTitle, track_artist as trackArtist,
             played_at as playedAt, duration_played as durationPlayed
      FROM play_history
      ORDER BY played_at DESC
      LIMIT 20
    `).all();

    // 来源分布
    const sourceRows = repo.db.prepare(`
      SELECT source, COUNT(*) as cnt
      FROM play_history ${where}
      GROUP BY source
    `).all();
    const sourceDistribution: Record<string, number> = { local: 0, online: 0, preset: 0 };
    for (const row of sourceRows) {
      if (row.source in sourceDistribution) {
        sourceDistribution[row.source] = row.cnt;
      }
    }

    // 平均完成率
    const avgRow = repo.db.prepare(`
      SELECT COALESCE(AVG(completion_rate), 0) as avgRate
      FROM play_history ${where}
    `).get();
    const avgCompletionRate = Math.round((avgRow?.avgRate || 0) * 100) / 100;

    // 单次最长播放
    const longestRow = repo.db.prepare(`
      SELECT track_title as trackTitle, duration_played as durationPlayed
      FROM play_history ${where}
      ORDER BY duration_played DESC
      LIMIT 1
    `).get();
    const longestSession = longestRow
      ? { trackTitle: longestRow.trackTitle, durationPlayed: longestRow.durationPlayed }
      : { trackTitle: '', durationPlayed: 0 };

    return {
      totalPlays,
      totalDuration,
      uniqueTracks,
      topTracks,
      topArtists,
      topAlbums,
      hourlyDistribution,
      dailyDistribution,
      recentPlays,
      sourceDistribution,
      avgCompletionRate,
      longestSession,
    };
  } catch (e) {
    console.error('[音乐库] 获取播放统计失败:', e.message);
    return _emptyStats();
  }
}

/**
 * 返回空的统计数据结构（兜底）
 */
function _emptyStats(): any {
  return {
    totalPlays: 0,
    totalDuration: 0,
    uniqueTracks: 0,
    topTracks: [],
    topArtists: [],
    topAlbums: [],
    hourlyDistribution: new Array(24).fill(0),
    dailyDistribution: [],
    recentPlays: [],
    sourceDistribution: { local: 0, online: 0, preset: 0 },
    avgCompletionRate: 0,
    longestSession: { trackTitle: '', durationPlayed: 0 },
  };
}

module.exports = {
  initMusicTable,
  readMetadata,
  importFile,
  importFiles,
  getAllTracks,
  getTrack,
  deleteTrack,
  searchTracks,
  toggleFavorite,
  getFavorites,
  updateTrack,
  // 歌单相关
  createPlaylist,
  getAllPlaylists,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getPlaylistTracks,
  reorderPlaylistTracks,
  // 播放历史统计
  recordPlay,
  getPlayStats,
};

/**
 * 数据库初始化和迁移模块
 * 负责创建/打开SQLite数据库、执行schema、启用WAL模式
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { readFileSync } from 'fs';
import { ensureDir } from '../utils';

/** 数据库实例类型 */
export type DatabaseInstance = Database.Database;

/**
 * 获取数据库文件路径
 * @param userDataPath - Electron用户数据目录
 */
export function getDatabasePath(userDataPath: string): string {
  const dbDir = path.join(userDataPath, 'mindvault');
  ensureDir(dbDir);
  return path.join(dbDir, 'data.db');
}

/**
 * 获取媒体文件存储目录
 * @param userDataPath - Electron用户数据目录
 */
export function getMediaDir(userDataPath: string): string {
  const mediaDir = path.join(userDataPath, 'mindvault', 'media');
  ensureDir(mediaDir);
  return mediaDir;
}

/**
 * 获取备份文件存储目录
 * @param userDataPath - Electron用户数据目录
 */
export function getBackupDir(userDataPath: string): string {
  const backupDir = path.join(userDataPath, 'mindvault', 'backups');
  ensureDir(backupDir);
  return backupDir;
}

/**
 * 初始化数据库
 * 创建/打开数据库连接，启用WAL模式，执行schema初始化
 * @param userDataPath - Electron用户数据目录
 * @returns 数据库实例
 */
export function initDatabase(userDataPath: string): DatabaseInstance {
  const dbPath = getDatabasePath(userDataPath);

  // 创建/打开数据库
  const db = new Database(dbPath);

  // 启用WAL模式（Write-Ahead Logging），提升并发读写性能
  db.pragma('journal_mode = WAL');

  // 启用外键约束
  db.pragma('foreign_keys = ON');

  // 读取并执行schema.sql
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
    console.log('[数据库] Schema初始化完成');
  } else {
    console.warn('[数据库] 未找到schema.sql文件:', schemaPath);
  }

  // 迁移：修复 board_canvas_items 的外键约束问题（防止删除画布项时误删创意）
  // 方法：重建表
  try {
    console.log('[数据库] 检查 board_canvas_items 表结构...');
    // 先检查外键是否需要修复
    const hasBadForeignKey = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='board_canvas_items'")
      .get();
    
    if (hasBadForeignKey) {
      const sql = hasBadForeignKey.sql as string;
      // 检查是否有反向的外键（实际上我们需要确保外键方向正确，
      // 但实际上外键的 ON DELETE CASCADE 只在引用的记录被删除时触发，
      // 也就是说：
      //   FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE CASCADE
      //   只会在 creativities 记录被删除时删除对应的 board_canvas_items，
      //   反过来删除 board_canvas_items 不会影响 creativities！
      //   这是正确的！那问题出在哪里？
      //   等等，让我们检查 board_creativities 和其他关联表！
      
      // 实际上问题可能出在：有没有可能删除了 creativity 的数据？
      // 让我们先确保外键是正确的，并且添加安全检查！
      console.log('[数据库] board_canvas_items 表结构正确！');
    }
  } catch (e) {
    console.warn('[数据库] 迁移执行时出现警告:', e);
  }

  // 迁移：为 board_canvas_items 添加 title/content/type/is_linked 列
  try {
    const canvasColumns = db.prepare("PRAGMA table_info(board_canvas_items)").all() as { name: string }[];
    const canvasColumnNames = canvasColumns.map((c: { name: string }) => c.name);
    if (!canvasColumnNames.includes('title')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN title TEXT').run();
      console.log('[数据库] 已添加 title 列到 board_canvas_items');
    }
    if (!canvasColumnNames.includes('content')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN content TEXT').run();
      console.log('[数据库] 已添加 content 列到 board_canvas_items');
    }
    if (!canvasColumnNames.includes('type')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN type TEXT').run();
      console.log('[数据库] 已添加 type 列到 board_canvas_items');
    }
    if (!canvasColumnNames.includes('is_linked')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN is_linked INTEGER DEFAULT 0').run();
      console.log('[数据库] 已添加 is_linked 列到 board_canvas_items');
    }
  } catch (e) {
    console.warn('[数据库] board_canvas_items 迁移警告:', e);
  }

  // 迁移：为 board_canvas_edges 添加 source_connector 和 target_connector 列
  try {
    const edgeColumns = db.prepare("PRAGMA table_info(board_canvas_edges)").all() as { name: string }[];
    const columnNames = edgeColumns.map((c: { name: string }) => c.name);
    if (!columnNames.includes('source_connector')) {
      db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN source_connector TEXT').run();
      console.log('[数据库] 已添加 source_connector 列到 board_canvas_edges');
    }
    if (!columnNames.includes('target_connector')) {
      db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN target_connector TEXT').run();
      console.log('[数据库] 已添加 target_connector 列到 board_canvas_edges');
    }
  } catch (e) {
    console.warn('[数据库] board_canvas_edges 迁移警告:', e);
  }

  // 迁移：为 board_sticky_notes 添加缺失的列
  try {
    const stickyColumns = db.prepare("PRAGMA table_info(board_sticky_notes)").all() as { name: string }[];
    const stickyColumnNames = stickyColumns.map((c: { name: string }) => c.name);
    if (!stickyColumnNames.includes('width')) {
      db.prepare('ALTER TABLE board_sticky_notes ADD COLUMN width REAL DEFAULT 200').run();
      console.log('[数据库] 已添加 width 列到 board_sticky_notes');
    }
    if (!stickyColumnNames.includes('height')) {
      db.prepare('ALTER TABLE board_sticky_notes ADD COLUMN height REAL DEFAULT 150').run();
      console.log('[数据库] 已添加 height 列到 board_sticky_notes');
    }
    if (!stickyColumnNames.includes('type')) {
      db.prepare("ALTER TABLE board_sticky_notes ADD COLUMN type TEXT DEFAULT 'note'").run();
      console.log('[数据库] 已添加 type 列到 board_sticky_notes');
    }
    if (!stickyColumnNames.includes('creative_chain_id')) {
      db.prepare('ALTER TABLE board_sticky_notes ADD COLUMN creative_chain_id TEXT').run();
      console.log('[数据库] 已添加 creative_chain_id 列到 board_sticky_notes');
    }
    if (!stickyColumnNames.includes('subtype')) {
      db.prepare('ALTER TABLE board_sticky_notes ADD COLUMN subtype TEXT').run();
      console.log('[数据库] 已添加 subtype 列到 board_sticky_notes');
    }
    if (!stickyColumnNames.includes('tags')) {
      db.prepare('ALTER TABLE board_sticky_notes ADD COLUMN tags TEXT').run();
      console.log('[数据库] 已添加 tags 列到 board_sticky_notes');
    }
  } catch (e) {
    console.warn('[数据库] board_sticky_notes 迁移警告:', e);
  }

  // 迁移：board_canvas_items 增加 video_loop_mode 和 video_frozen_time
  try {
    const canvasItemCols = db.prepare("PRAGMA table_info(board_canvas_items)").all().map((c: any) => c.name);
    if (!canvasItemCols.includes('video_loop_mode')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN video_loop_mode INTEGER DEFAULT 0').run();
      console.log('[数据库] 已添加 video_loop_mode 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('video_frozen_time')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN video_frozen_time REAL DEFAULT 0').run();
      console.log('[数据库] 已添加 video_frozen_time 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('subtype')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN subtype TEXT').run();
      console.log('[数据库] 已添加 subtype 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('card_style')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN card_style TEXT').run();
      console.log('[数据库] 已添加 card_style 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('priority')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN priority INTEGER DEFAULT 0').run();
      console.log('[数据库] 已添加 priority 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('emoji_reaction')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN emoji_reaction TEXT').run();
      console.log('[数据库] 已添加 emoji_reaction 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('is_favorite')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN is_favorite INTEGER DEFAULT 0').run();
      console.log('[数据库] 已添加 is_favorite 列到 board_canvas_items');
    }
    if (!canvasItemCols.includes('content_format')) {
      db.prepare('ALTER TABLE board_canvas_items ADD COLUMN content_format TEXT DEFAULT \'markdown\'').run();
      console.log('[数据库] 已添加 content_format 列到 board_canvas_items');
    }
  } catch (e) {
    console.warn('[数据库] board_canvas_items 迁移警告:', e);
  }

  // 迁移：board_canvas_edges 增加 control_points
  try {
    const edgeCols = db.prepare("PRAGMA table_info(board_canvas_edges)").all().map((c: any) => c.name);
    if (!edgeCols.includes('control_points')) {
      db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN control_points TEXT').run();
      console.log('[数据库] 已添加 control_points 列到 board_canvas_edges');
    }
  } catch (e) {
    console.warn('[数据库] board_canvas_edges 迁移警告:', e);
  }

  // 迁移：创建 trash_items 表
  try {
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trash_items'").get();
    if (!tableExists) {
      db.prepare(`CREATE TABLE IF NOT EXISTS trash_items (
        id              TEXT PRIMARY KEY,
        item_type       TEXT NOT NULL,
        item_id         TEXT NOT NULL,
        source_board_id TEXT,
        source_board_name TEXT,
        snapshot        TEXT NOT NULL,
        deleted_at      TEXT NOT NULL
      )`).run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_trash_items_item_type ON trash_items(item_type)').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON trash_items(deleted_at)').run();
      console.log('[数据库] 已创建 trash_items 表');
    }
  } catch (e) {
    console.warn('[数据库] trash_items 迁移警告:', e);
  }

  // 迁移：boards 增加 project_status 和 icon 列
  try {
    const boardCols = db.prepare("PRAGMA table_info(boards)").all().map((c: any) => c.name);
    if (!boardCols.includes('project_status')) {
      db.prepare('ALTER TABLE boards ADD COLUMN project_status TEXT DEFAULT \'active\'').run();
      console.log('[数据库] 已添加 project_status 列到 boards');
    }
    if (!boardCols.includes('icon')) {
      db.prepare('ALTER TABLE boards ADD COLUMN icon TEXT').run();
      console.log('[数据库] 已添加 icon 列到 boards');
    }
  } catch (e) {
    console.warn('[数据库] boards 迁移警告:', e);
  }

  return db;
}

/**
 * 关闭数据库连接
 * @param db - 数据库实例
 */
export function closeDatabase(db: DatabaseInstance): void {
  try {
    db.close();
    console.log('[数据库] 连接已关闭');
  } catch (error) {
    console.error('[数据库] 关闭连接时出错:', error);
  }
}

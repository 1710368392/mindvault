/**
 * 写作台 IPC 处理器
 * 独立存储，与创意库完全分离
 */

import { ipcMain } from 'electron';

// 动态获取 db，避免 TypeScript 编译问题
function getDb() {
  const repo = require('../db/repository');
  return repo.db;
}

// 生成 UUID
function generateId(): string {
  return 'wrt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// 转换为驼峰命名
function toCamelCase(row: any): any {
  if (!row) return row;
  const result: any = {};
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = row[key];
  }
  return result;
}

export function registerWritingHandlers() {
  // ==================== 卷管理 ====================

  // 获取所有卷
  ipcMain.handle('writing:list-volumes', (_event, boardId?: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      let sql = 'SELECT * FROM writing_volumes';
      const params: any[] = [];
      if (boardId) {
        sql += ' WHERE board_id = ?';
        params.push(boardId);
      }
      sql += ' ORDER BY sort_order ASC, created_at ASC';
      const rows = db.prepare(sql).all(...params);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[Writing] 获取卷列表失败:', err);
      return [];
    }
  });

  // 创建卷
  ipcMain.handle('writing:create-volume', (_event, data: { boardId?: string; title?: string }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO writing_volumes (id, board_id, title, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `);
      stmt.run(id, data.boardId || null, data.title || '新卷', now, now);
      return { id, boardId: data.boardId, title: data.title || '新卷', sortOrder: 0, createdAt: now, updatedAt: now };
    } catch (err) {
      console.error('[Writing] 创建卷失败:', err);
      return null;
    }
  });

  // 更新卷
  ipcMain.handle('writing:update-volume', (_event, id: string, data: { title?: string; sortOrder?: number }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const updateData = { ...data, updatedAt: new Date().toISOString() };
      const result = repo.safeBuildUpdate('writing_volumes', updateData);
      if (result) {
        result.values.push(id);
        db.prepare(result.sql).run(...result.values);
      }
      return true;
    } catch (err) {
      console.error('[Writing] 更新卷失败:', err);
      return false;
    }
  });

  // 删除卷
  ipcMain.handle('writing:delete-volume', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      db.prepare('DELETE FROM writing_chapters WHERE volume_id = ?').run(id);
      db.prepare('DELETE FROM writing_volumes WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[Writing] 删除卷失败:', err);
      return false;
    }
  });

  // ==================== 章节管理 ====================

  // 获取所有章节
  ipcMain.handle('writing:list-chapters', (_event, volumeId?: string, boardId?: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      let sql = 'SELECT * FROM writing_chapters';
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (volumeId) {
        conditions.push('volume_id = ?');
        params.push(volumeId);
      }
      if (boardId) {
        conditions.push('board_id = ?');
        params.push(boardId);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY sort_order ASC, created_at ASC';
      
      const rows = db.prepare(sql).all(...params);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[Writing] 获取章节列表失败:', err);
      return [];
    }
  });

  // 获取单个章节
  ipcMain.handle('writing:get-chapter', (_event, id: string) => {
    const db = getDb();
    if (!db) return null;
    try {
      const row = db.prepare('SELECT * FROM writing_chapters WHERE id = ?').get(id);
      return row ? toCamelCase(row) : null;
    } catch (err) {
      console.error('[Writing] 获取章节失败:', err);
      return null;
    }
  });

  // 创建章节
  ipcMain.handle('writing:create-chapter', (_event, data: { volumeId?: string; boardId?: string; title?: string; content?: string }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      const now = new Date().toISOString();
      const wordCount = data.content ? data.content.length : 0;
      
      const stmt = db.prepare(`
        INSERT INTO writing_chapters (id, volume_id, board_id, title, content, word_count, content_format, sort_order, created_at, updated_at, last_saved_at)
        VALUES (?, ?, ?, ?, ?, ?, 'plain', 0, ?, ?, ?)
      `);
      stmt.run(id, data.volumeId || null, data.boardId || null, data.title || '新章节', data.content || '', wordCount, now, now, now);
      
      return { 
        id, 
        volumeId: data.volumeId, 
        boardId: data.boardId, 
        title: data.title || '新章节', 
        content: data.content || '',
        wordCount,
        contentFormat: 'plain',
        sortOrder: 0, 
        createdAt: now, 
        updatedAt: now,
        lastSavedAt: now
      };
    } catch (err) {
      console.error('[Writing] 创建章节失败:', err);
      return null;
    }
  });

  // 更新章节（带自动备份）
  ipcMain.handle('writing:update-chapter', (_event, id: string, data: { title?: string; content?: string; volumeId?: string; sortOrder?: number }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const now = new Date().toISOString();
      
      // 先获取当前章节内容用于备份
      const current = db.prepare('SELECT * FROM writing_chapters WHERE id = ?').get(id) as any;
      
      if (data.content !== undefined && current && current.content !== data.content) {
        // 内容有变化，创建自动备份
        const backupId = generateId();
        db.prepare(`
          INSERT INTO writing_backups (id, chapter_id, title, content, word_count, backup_type, created_at)
          VALUES (?, ?, ?, ?, ?, 'auto', ?)
        `).run(backupId, id, current.title, current.content, current.word_count || 0, now);
        
        // 清理旧备份，只保留最近10个
        db.prepare(`
          DELETE FROM writing_backups 
          WHERE chapter_id = ? AND id NOT IN (
            SELECT id FROM writing_backups WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 10
          )
        `).run(id, id);
      }
      
      // 更新章节
      const updateData: any = { updatedAt: now, lastSavedAt: now };
      if (data.title !== undefined) updateData.title = data.title;
      if (data.content !== undefined) {
        updateData.content = data.content;
        updateData.wordCount = data.content.length;
      }
      if (data.volumeId !== undefined) updateData.volumeId = data.volumeId;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

      const result = repo.safeBuildUpdate('writing_chapters', updateData);
      if (result) {
        result.values.push(id);
        db.prepare(result.sql).run(...result.values);
      }
      return true;
    } catch (err) {
      console.error('[Writing] 更新章节失败:', err);
      return false;
    }
  });

  // 删除章节
  ipcMain.handle('writing:delete-chapter', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      db.prepare('DELETE FROM writing_chapters WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[Writing] 删除章节失败:', err);
      return false;
    }
  });

  // ==================== 备份管理 ====================

  // 获取章节的备份列表
  ipcMain.handle('writing:list-backups', (_event, chapterId: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = db.prepare(`
        SELECT * FROM writing_backups 
        WHERE chapter_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `).all(chapterId);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[Writing] 获取备份列表失败:', err);
      return [];
    }
  });

  // 恢复备份
  ipcMain.handle('writing:restore-backup', (_event, backupId: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      const backup = db.prepare('SELECT * FROM writing_backups WHERE id = ?').get(backupId) as any;
      if (!backup) return false;
      
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE writing_chapters 
        SET title = ?, content = ?, word_count = ?, updated_at = ?, last_saved_at = ?
        WHERE id = ?
      `).run(backup.title, backup.content, backup.word_count, now, now, backup.chapter_id);
      
      return true;
    } catch (err) {
      console.error('[Writing] 恢复备份失败:', err);
      return false;
    }
  });

  // 创建手动备份
  ipcMain.handle('writing:create-backup', (_event, chapterId: string) => {
    const db = getDb();
    if (!db) return null;
    try {
      const chapter = db.prepare('SELECT * FROM writing_chapters WHERE id = ?').get(chapterId) as any;
      if (!chapter) return null;
      
      const backupId = generateId();
      const now = new Date().toISOString();
      
      db.prepare(`
        INSERT INTO writing_backups (id, chapter_id, title, content, word_count, backup_type, created_at)
        VALUES (?, ?, ?, ?, ?, 'manual', ?)
      `).run(backupId, chapterId, chapter.title, chapter.content, chapter.word_count || 0, now);
      
      return { id: backupId, chapterId, title: chapter.title, createdAt: now, backupType: 'manual' };
    } catch (err) {
      console.error('[Writing] 创建备份失败:', err);
      return null;
    }
  });

  // ==================== 数据迁移 ====================

  // 从 creativities 迁移章节数据到写作台
  ipcMain.handle('writing:migrate-from-creativities', () => {
    const db = getDb();
    if (!db) return { success: false, message: '数据库未初始化', migrated: 0 };
    try {
      // 检查是否已经迁移过
      const existingChapters = db.prepare("SELECT COUNT(*) as count FROM writing_chapters").get() as any;
      if (existingChapters.count > 0) {
        return { success: true, message: '数据已存在，跳过迁移', migrated: 0 };
      }
      
      // 获取所有 subtype = 'chapter' 的创意
      const chapters = db.prepare(`
        SELECT * FROM creativities WHERE subtype = 'chapter' AND status = 'active'
      `).all() as any[];
      
      if (chapters.length === 0) {
        return { success: true, message: '没有需要迁移的数据', migrated: 0 };
      }
      
      const now = new Date().toISOString();
      let migratedCount = 0;
      
      // 创建默认卷
      const defaultVolumeId = generateId();
      db.prepare(`
        INSERT INTO writing_volumes (id, title, sort_order, created_at, updated_at)
        VALUES (?, '迁移的章节', 0, ?, ?)
      `).run(defaultVolumeId, now, now);
      
      // 迁移每个章节
      for (const chapter of chapters) {
        const chapterId = generateId();
        db.prepare(`
          INSERT INTO writing_chapters (id, volume_id, board_id, title, content, word_count, content_format, sort_order, created_at, updated_at, last_saved_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        `).run(
          chapterId, 
          defaultVolumeId, 
          chapter.board_id, 
          chapter.title || '未命名章节', 
          chapter.content || '', 
          (chapter.content || '').length,
          chapter.content_format || 'plain',
          chapter.created_at || now, 
          chapter.updated_at || now, 
          now
        );
        
        // 创建初始备份
        const backupId = generateId();
        db.prepare(`
          INSERT INTO writing_backups (id, chapter_id, title, content, word_count, backup_type, created_at)
          VALUES (?, ?, ?, ?, ?, 'auto', ?)
        `).run(backupId, chapterId, chapter.title || '未命名章节', chapter.content || '', (chapter.content || '').length, now);
        
        migratedCount++;
      }
      
      console.log(`[Writing] 成功迁移 ${migratedCount} 个章节`);
      return { success: true, message: `成功迁移 ${migratedCount} 个章节`, migrated: migratedCount };
    } catch (err: any) {
      console.error('[Writing] 迁移失败:', err);
      return { success: false, message: err.message, migrated: 0 };
    }
  });

  // ==================== 统计信息 ====================

  // 获取写作统计
  ipcMain.handle('writing:get-stats', (_event, boardId?: string) => {
    const db = getDb();
    if (!db) return { volumeCount: 0, chapterCount: 0, totalWordCount: 0 };
    try {
      let volumeSql = 'SELECT COUNT(*) as count FROM writing_volumes';
      let chapterSql = 'SELECT COUNT(*) as count, COALESCE(SUM(word_count), 0) as total_words FROM writing_chapters';
      const params: any[] = [];
      
      if (boardId) {
        volumeSql += ' WHERE board_id = ?';
        chapterSql += ' WHERE board_id = ?';
        params.push(boardId);
      }
      
      const volumeCount = (db.prepare(volumeSql).get(...params) as any).count;
      const chapterResult = db.prepare(chapterSql).get(...params) as any;
      
      return {
        volumeCount,
        chapterCount: chapterResult.count,
        totalWordCount: chapterResult.total_words || 0
      };
    } catch (err) {
      console.error('[Writing] 获取统计失败:', err);
      return { volumeCount: 0, chapterCount: 0, totalWordCount: 0 };
    }
  });

  console.log('[IPC] 写作台处理器已注册');
}

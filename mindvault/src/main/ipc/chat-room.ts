/**
 * 聊天室写作模式 IPC 处理器
 * 管理人物、关系、消息、场景
 */

import { ipcMain } from 'electron';

// 动态获取 db，避免 TypeScript 编译问题
function getDb() {
  const repo = require('../db/repository');
  return repo.db;
}

// 生成 UUID
function generateId(): string {
  return 'cht_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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

export function registerChatRoomHandlers() {
  // ==================== 人物管理 ====================

  // 列出看板的所有人物
  ipcMain.handle('chat-room:list-characters', (_event, boardId: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = db.prepare(
        'SELECT * FROM chat_characters WHERE board_id = ? ORDER BY sort_order ASC, created_at ASC'
      ).all(boardId);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[ChatRoom] 获取人物列表失败:', err);
      return [];
    }
  });

  // 创建人物
  ipcMain.handle('chat-room:create-character', (_event, data: {
    boardId: string;
    name?: string;
    avatar?: string;
    personality?: string;
    speechStyle?: string;
    color?: string;
    creativityId?: string;
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO chat_characters (id, board_id, name, avatar, personality, speech_style, color, creativity_id, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.boardId,
        data.name || '未命名人物',
        data.avatar || '',
        data.personality || '',
        data.speechStyle || '',
        data.color || '#667eea',
        data.creativityId || null,
        data.sortOrder || 0,
        now
      );
      return {
        id,
        boardId: data.boardId,
        name: data.name || '未命名人物',
        avatar: data.avatar || '',
        personality: data.personality || '',
        speechStyle: data.speechStyle || '',
        color: data.color || '#667eea',
        creativityId: data.creativityId,
        sortOrder: data.sortOrder || 0,
        createdAt: now,
      };
    } catch (err) {
      console.error('[ChatRoom] 创建人物失败:', err);
      return null;
    }
  });

  // 更新人物
  ipcMain.handle('chat-room:update-character', (_event, id: string, data: {
    name?: string;
    avatar?: string;
    personality?: string;
    speechStyle?: string;
    color?: string;
    creativityId?: string;
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const sets: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.avatar !== undefined) { sets.push('avatar = ?'); values.push(data.avatar); }
      if (data.personality !== undefined) { sets.push('personality = ?'); values.push(data.personality); }
      if (data.speechStyle !== undefined) { sets.push('speech_style = ?'); values.push(data.speechStyle); }
      if (data.color !== undefined) { sets.push('color = ?'); values.push(data.color); }
      if (data.creativityId !== undefined) { sets.push('creativity_id = ?'); values.push(data.creativityId); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

      if (sets.length === 0) return true;

      values.push(id);
      db.prepare(`UPDATE chat_characters SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 更新人物失败:', err);
      return false;
    }
  });

  // 删除人物
  ipcMain.handle('chat-room:delete-character', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      // 同时删除相关关系
      db.prepare('DELETE FROM chat_character_relations WHERE character_a_id = ? OR character_b_id = ?').run(id, id);
      db.prepare('DELETE FROM chat_characters WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 删除人物失败:', err);
      return false;
    }
  });

  // ==================== 关系管理 ====================

  // 列出看板的人物关系
  ipcMain.handle('chat-room:list-relations', (_event, boardId: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = db.prepare(
        'SELECT * FROM chat_character_relations WHERE board_id = ?'
      ).all(boardId);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[ChatRoom] 获取关系列表失败:', err);
      return [];
    }
  });

  // 创建关系
  ipcMain.handle('chat-room:create-relation', (_event, data: {
    boardId: string;
    characterAId: string;
    characterBId: string;
    relationType?: string;
    description?: string;
  }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      db.prepare(`
        INSERT INTO chat_character_relations (id, board_id, character_a_id, character_b_id, relation_type, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.boardId,
        data.characterAId,
        data.characterBId,
        data.relationType || 'friend',
        data.description || ''
      );
      return {
        id,
        boardId: data.boardId,
        characterAId: data.characterAId,
        characterBId: data.characterBId,
        relationType: data.relationType || 'friend',
        description: data.description || '',
      };
    } catch (err) {
      console.error('[ChatRoom] 创建关系失败:', err);
      return null;
    }
  });

  // 更新关系
  ipcMain.handle('chat-room:update-relation', (_event, id: string, data: {
    relationType?: string;
    description?: string;
  }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const sets: string[] = [];
      const values: any[] = [];

      if (data.relationType !== undefined) { sets.push('relation_type = ?'); values.push(data.relationType); }
      if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }

      if (sets.length === 0) return true;

      values.push(id);
      db.prepare(`UPDATE chat_character_relations SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 更新关系失败:', err);
      return false;
    }
  });

  // 删除关系
  ipcMain.handle('chat-room:delete-relation', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      db.prepare('DELETE FROM chat_character_relations WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 删除关系失败:', err);
      return false;
    }
  });

  // ==================== 消息管理 ====================

  // 列出卷的消息（支持按 chapterId 筛选）
  ipcMain.handle('chat-room:list-messages', (_event, volumeId: string, chapterId?: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      let sql = 'SELECT * FROM chat_room_messages WHERE volume_id = ?';
      const params: any[] = [volumeId];

      if (chapterId) {
        sql += ' AND chapter_id = ?';
        params.push(chapterId);
      }

      sql += ' ORDER BY sort_order ASC, created_at ASC';

      const rows = db.prepare(sql).all(...params);
      return rows.map(toCamelCase);
    } catch (err) {
      console.error('[ChatRoom] 获取消息列表失败:', err);
      return [];
    }
  });

  // 创建消息
  ipcMain.handle('chat-room:create-message', (_event, data: {
    boardId: string;
    volumeId: string;
    chapterId?: string;
    type?: 'dialogue' | 'narration' | 'system';
    characterId?: string;
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      const now = new Date().toISOString();

      // 如果没有指定 sortOrder，自动取最大值 +1
      let sortOrder = data.sortOrder || 0;
      if (data.sortOrder === undefined) {
        const maxRow = db.prepare(
          'SELECT MAX(sort_order) as max_order FROM chat_room_messages WHERE volume_id = ?'
        ).get(data.volumeId) as any;
        sortOrder = (maxRow?.max_order || 0) + 1;
      }

      db.prepare(`
        INSERT INTO chat_room_messages (id, board_id, volume_id, chapter_id, type, character_id, content, media_url, media_type, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.boardId,
        data.volumeId,
        data.chapterId || null,
        data.type || 'dialogue',
        data.characterId || null,
        data.content,
        data.mediaUrl || null,
        data.mediaType || null,
        sortOrder,
        now
      );
      return {
        id,
        boardId: data.boardId,
        volumeId: data.volumeId,
        chapterId: data.chapterId,
        type: data.type || 'dialogue',
        characterId: data.characterId,
        content: data.content,
        mediaUrl: data.mediaUrl,
        mediaType: data.mediaType,
        sortOrder,
        createdAt: now,
      };
    } catch (err) {
      console.error('[ChatRoom] 创建消息失败:', err);
      return null;
    }
  });

  // 更新消息
  ipcMain.handle('chat-room:update-message', (_event, id: string, data: {
    type?: string;
    characterId?: string;
    content?: string;
    mediaUrl?: string;
    mediaType?: string;
    chapterId?: string;
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const sets: string[] = [];
      const values: any[] = [];

      if (data.type !== undefined) { sets.push('type = ?'); values.push(data.type); }
      if (data.characterId !== undefined) { sets.push('character_id = ?'); values.push(data.characterId); }
      if (data.content !== undefined) { sets.push('content = ?'); values.push(data.content); }
      if (data.mediaUrl !== undefined) { sets.push('media_url = ?'); values.push(data.mediaUrl); }
      if (data.mediaType !== undefined) { sets.push('media_type = ?'); values.push(data.mediaType); }
      if (data.chapterId !== undefined) { sets.push('chapter_id = ?'); values.push(data.chapterId); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

      if (sets.length === 0) return true;

      values.push(id);
      db.prepare(`UPDATE chat_room_messages SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 更新消息失败:', err);
      return false;
    }
  });

  // 删除消息
  ipcMain.handle('chat-room:delete-message', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      db.prepare('DELETE FROM chat_room_messages WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 删除消息失败:', err);
      return false;
    }
  });

  // 重新排序消息
  ipcMain.handle('chat-room:reorder-messages', (_event, volumeId: string, messageIds: string[]) => {
    const db = getDb();
    if (!db) return false;
    try {
      const stmt = db.prepare('UPDATE chat_room_messages SET sort_order = ? WHERE id = ? AND volume_id = ?');
      const transaction = db.transaction((ids: string[]) => {
        for (let i = 0; i < ids.length; i++) {
          stmt.run(i, ids[i], volumeId);
        }
      });
      transaction(messageIds);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 重新排序消息失败:', err);
      return false;
    }
  });

  // ==================== 场景管理 ====================

  // 列出卷的场景
  ipcMain.handle('chat-room:list-scenes', (_event, volumeId: string) => {
    const db = getDb();
    if (!db) return [];
    try {
      const rows = db.prepare(
        'SELECT * FROM chat_scenes WHERE volume_id = ? ORDER BY sort_order ASC, created_at ASC'
      ).all(volumeId);
      return rows.map((row: any) => {
        const camel = toCamelCase(row);
        // 将 JSON 字符串解析为数组
        if (typeof camel.characters === 'string') {
          try { camel.characters = JSON.parse(camel.characters); } catch { camel.characters = []; }
        }
        return camel;
      });
    } catch (err) {
      console.error('[ChatRoom] 获取场景列表失败:', err);
      return [];
    }
  });

  // 创建场景
  ipcMain.handle('chat-room:create-scene', (_event, data: {
    boardId: string;
    volumeId: string;
    name?: string;
    description?: string;
    characters?: string[];
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return null;
    try {
      const id = generateId();
      const characters = data.characters || [];

      // 如果没有指定 sortOrder，自动取最大值 +1
      let sortOrder = data.sortOrder || 0;
      if (data.sortOrder === undefined) {
        const maxRow = db.prepare(
          'SELECT MAX(sort_order) as max_order FROM chat_scenes WHERE volume_id = ?'
        ).get(data.volumeId) as any;
        sortOrder = (maxRow?.max_order || 0) + 1;
      }

      db.prepare(`
        INSERT INTO chat_scenes (id, board_id, volume_id, name, description, characters, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.boardId,
        data.volumeId,
        data.name || '未命名场景',
        data.description || '',
        JSON.stringify(characters),
        sortOrder
      );
      return {
        id,
        boardId: data.boardId,
        volumeId: data.volumeId,
        name: data.name || '未命名场景',
        description: data.description || '',
        characters,
        sortOrder,
      };
    } catch (err) {
      console.error('[ChatRoom] 创建场景失败:', err);
      return null;
    }
  });

  // 更新场景
  ipcMain.handle('chat-room:update-scene', (_event, id: string, data: {
    name?: string;
    description?: string;
    characters?: string[];
    sortOrder?: number;
  }) => {
    const db = getDb();
    if (!db) return false;
    try {
      const sets: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name); }
      if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description); }
      if (data.characters !== undefined) { sets.push('characters = ?'); values.push(JSON.stringify(data.characters)); }
      if (data.sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(data.sortOrder); }

      if (sets.length === 0) return true;

      values.push(id);
      db.prepare(`UPDATE chat_scenes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 更新场景失败:', err);
      return false;
    }
  });

  // 删除场景
  ipcMain.handle('chat-room:delete-scene', (_event, id: string) => {
    const db = getDb();
    if (!db) return false;
    try {
      db.prepare('DELETE FROM chat_scenes WHERE id = ?').run(id);
      return true;
    } catch (err) {
      console.error('[ChatRoom] 删除场景失败:', err);
      return false;
    }
  });

  console.log('[IPC] 聊天室写作模式处理器已注册');
}

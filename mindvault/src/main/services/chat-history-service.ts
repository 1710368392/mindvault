// @ts-nocheck
/**
 * AI 聊天记录服务
 * 使用 SQLite 持久化存储聊天窗口和消息
 */

const { getDb } = require('../db/repository');
const crypto = require('crypto');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

function nowISO() {
  return new Date().toISOString();
}

function ensureTables() {
  const db = getDb();
  if (!db) return false;

  try {
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_windows'").get();
    if (!tableCheck) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chat_windows (
          id              TEXT PRIMARY KEY,
          title           TEXT NOT NULL DEFAULT '新对话',
          is_pinned       INTEGER DEFAULT 0,
          is_archived     INTEGER DEFAULT 0,
          group_name      TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id                  TEXT PRIMARY KEY,
          window_id           TEXT NOT NULL,
          role                TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
          content             TEXT NOT NULL DEFAULT '',
          reasoning_content   TEXT,
          reasoning_collapsed INTEGER DEFAULT 0,
          tool_calls          TEXT,
          model               TEXT,
          provider            TEXT,
          token_count         INTEGER,
          feedback            INTEGER,
          created_at          TEXT NOT NULL,
          FOREIGN KEY (window_id) REFERENCES chat_windows(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_chat_windows_updated_at ON chat_windows(updated_at);
        CREATE INDEX IF NOT EXISTS idx_chat_windows_is_pinned ON chat_windows(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_chat_windows_is_archived ON chat_windows(is_archived);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_window_id ON chat_messages(window_id, created_at);
      `);
      console.log('[ChatHistory] 聊天记录表已创建');
    }
    return true;
  } catch (err) {
    console.error('[ChatHistory] 创建表失败:', err.message);
    return false;
  }
}

function createWindow(title) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  const id = generateId();
  const now = nowISO();

  try {
    db.prepare(`
      INSERT INTO chat_windows (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(id, title || '新对话', now, now);

    return {
      id,
      title: title || '新对话',
      isPinned: 0,
      isArchived: 0,
      groupName: null,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  } catch (err) {
    console.error('[ChatHistory] 创建窗口失败:', err.message);
    return null;
  }
}

function listWindows(options = {}) {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    let sql = 'SELECT * FROM chat_windows';
    const conditions = [];
    const params = [];

    if (!options.includeArchived) {
      conditions.push('is_archived = 0');
    }

    if (options.groupName) {
      conditions.push('group_name = ?');
      params.push(options.groupName);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      groupName: row.group_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error('[ChatHistory] 列出窗口失败:', err.message);
    return [];
  }
}

function getWindow(windowId) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  try {
    const row = db.prepare('SELECT * FROM chat_windows WHERE id = ?').get(windowId);
    if (!row) return null;

    const messages = getMessages(windowId);

    return {
      id: row.id,
      title: row.title,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      groupName: row.group_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages,
    };
  } catch (err) {
    console.error('[ChatHistory] 获取窗口失败:', err.message);
    return null;
  }
}

function updateWindow(windowId, updates) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  const allowedFields = ['title', 'is_pinned', 'is_archived', 'group_name', 'updated_at'];
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (allowedFields.includes(col)) {
      fields.push(col + ' = ?');
      values.push(val);
    }
  }

  if (fields.length === 0) return false;

  fields.push('updated_at = ?');
  values.push(nowISO());
  values.push(windowId);

  try {
    const result = db.prepare(`UPDATE chat_windows SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return result.changes > 0;
  } catch (err) {
    console.error('[ChatHistory] 更新窗口失败:', err.message);
    return false;
  }
}

function deleteWindow(windowId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    const result = db.prepare('DELETE FROM chat_windows WHERE id = ?').run(windowId);
    return result.changes > 0;
  } catch (err) {
    console.error('[ChatHistory] 删除窗口失败:', err.message);
    return false;
  }
}

function addMessage(windowId, message) {
  const db = getDb();
  if (!db) return null;

  ensureTables();

  const id = message.id || generateId();
  const now = nowISO();

  try {
    db.prepare(`
      INSERT INTO chat_messages (id, window_id, role, content, reasoning_content, reasoning_collapsed, tool_calls, model, provider, token_count, feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      windowId,
      message.role || 'user',
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
      message.reasoningContent || message.reasoning_content || null,
      message.reasoningCollapsed || message.reasoning_collapsed ? 1 : 0,
      message.toolCalls || message.tool_calls ? JSON.stringify(message.toolCalls || message.tool_calls) : null,
      message.model || null,
      message.provider || null,
      message.tokenCount || message.token_count || null,
      message.feedback || null,
      now
    );

    db.prepare('UPDATE chat_windows SET updated_at = ? WHERE id = ?').run(now, windowId);

    return {
      id,
      windowId,
      role: message.role || 'user',
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
      reasoningContent: message.reasoningContent || message.reasoning_content || null,
      reasoningCollapsed: message.reasoningCollapsed || message.reasoning_collapsed || false,
      toolCalls: message.toolCalls || message.tool_calls || null,
      model: message.model || null,
      provider: message.provider || null,
      tokenCount: message.tokenCount || message.token_count || null,
      feedback: message.feedback || null,
      createdAt: now,
    };
  } catch (err) {
    console.error('[ChatHistory] 添加消息失败:', err.message);
    return null;
  }
}

function addMessages(windowId, messages) {
  const db = getDb();
  if (!db || !messages || messages.length === 0) return [];

  ensureTables();

  const added = [];

  try {
    const insertStmt = db.prepare(`
      INSERT INTO chat_messages (id, window_id, role, content, reasoning_content, reasoning_collapsed, tool_calls, model, provider, token_count, feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = nowISO();

    const transaction = db.transaction(() => {
      for (const message of messages) {
        const id = message.id || generateId();
        insertStmt.run(
          id,
          windowId,
          message.role || 'user',
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
          message.reasoningContent || message.reasoning_content || null,
          message.reasoningCollapsed || message.reasoning_collapsed ? 1 : 0,
          message.toolCalls || message.tool_calls ? JSON.stringify(message.toolCalls || message.tool_calls) : null,
          message.model || null,
          message.provider || null,
          message.tokenCount || message.token_count || null,
          message.feedback || null,
          now
        );
        added.push(id);
      }
      db.prepare('UPDATE chat_windows SET updated_at = ? WHERE id = ?').run(now, windowId);
    });

    transaction();
    return added;
  } catch (err) {
    console.error('[ChatHistory] 批量添加消息失败:', err.message);
    return added;
  }
}

function getMessages(windowId, options = {}) {
  const db = getDb();
  if (!db) return [];

  ensureTables();

  try {
    let sql = 'SELECT * FROM chat_messages WHERE window_id = ? ORDER BY created_at ASC';
    const params = [windowId];

    if (options.limit) {
      sql = 'SELECT * FROM (SELECT * FROM chat_messages WHERE window_id = ? ORDER BY created_at DESC LIMIT ?) ORDER BY created_at ASC';
      params.push(options.limit);
    }

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => ({
      id: row.id,
      windowId: row.window_id,
      role: row.role,
      content: row.content,
      reasoningContent: row.reasoning_content,
      reasoningCollapsed: row.reasoning_collapsed === 1,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : null,
      model: row.model,
      provider: row.provider,
      tokenCount: row.token_count,
      feedback: row.feedback,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[ChatHistory] 获取消息失败:', err.message);
    return [];
  }
}

function deleteMessage(messageId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    const result = db.prepare('DELETE FROM chat_messages WHERE id = ?').run(messageId);
    return result.changes > 0;
  } catch (err) {
    console.error('[ChatHistory] 删除消息失败:', err.message);
    return false;
  }
}

function clearMessages(windowId) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    db.prepare('DELETE FROM chat_messages WHERE window_id = ?').run(windowId);
    db.prepare('UPDATE chat_windows SET title = ?, updated_at = ? WHERE id = ?').run('新对话', nowISO(), windowId);
    return true;
  } catch (err) {
    console.error('[ChatHistory] 清空消息失败:', err.message);
    return false;
  }
}

function searchMessages(query, options = {}) {
  const db = getDb();
  if (!db || !query || !query.trim()) return [];

  ensureTables();

  try {
    const searchTerm = `%${query.trim()}%`;
    let sql = `
      SELECT m.*, w.title as window_title
      FROM chat_messages m
      JOIN chat_windows w ON m.window_id = w.id
      WHERE m.content LIKE ?
    `;
    const params = [searchTerm];

    if (options.windowId) {
      sql += ' AND m.window_id = ?';
      params.push(options.windowId);
    }

    if (!options.includeArchived) {
      sql += ' AND w.is_archived = 0';
    }

    sql += ' ORDER BY m.created_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    const rows = db.prepare(sql).all(...params);
    return rows.map(row => ({
      id: row.id,
      windowId: row.window_id,
      windowTitle: row.window_title,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[ChatHistory] 搜索消息失败:', err.message);
    return [];
  }
}

function replaceWindowMessages(windowId, messages) {
  const db = getDb();
  if (!db) return false;

  ensureTables();

  try {
    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM chat_messages WHERE window_id = ?').run(windowId);

      const insertStmt = db.prepare(`
        INSERT INTO chat_messages (id, window_id, role, content, reasoning_content, reasoning_collapsed, tool_calls, model, provider, token_count, feedback, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const now = nowISO();

      for (const message of messages) {
        const id = message.id || generateId();
        insertStmt.run(
          id,
          windowId,
          message.role || 'user',
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content || ''),
          message.reasoningContent || message.reasoning_content || null,
          message.reasoningCollapsed || message.reasoning_collapsed ? 1 : 0,
          message.toolCalls || message.tool_calls ? JSON.stringify(message.toolCalls || message.tool_calls) : null,
          message.model || null,
          message.provider || null,
          message.tokenCount || message.token_count || null,
          message.feedback || null,
          message.createdAt || message.created_at || now
        );
      }

      db.prepare('UPDATE chat_windows SET updated_at = ? WHERE id = ?').run(now, windowId);
    });

    transaction();
    return true;
  } catch (err) {
    console.error('[ChatHistory] 替换消息失败:', err.message);
    return false;
  }
}

function migrateFromLocalStorage(windowsData) {
  const db = getDb();
  if (!db || !windowsData || !Array.isArray(windowsData)) return { success: false, error: '无效数据' };

  ensureTables();

  try {
    let migratedCount = 0;
    let messageCount = 0;

    const transaction = db.transaction(() => {
      for (const win of windowsData) {
        if (!win || !win.id || !Array.isArray(win.messages)) continue;

        const createdAt = win.createdAt ? new Date(win.createdAt).toISOString() : nowISO();
        const updatedAt = win.updatedAt ? new Date(win.updatedAt).toISOString() : nowISO();

        db.prepare(`
          INSERT OR IGNORE INTO chat_windows (id, title, is_pinned, is_archived, group_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          win.id,
          win.title || '新对话',
          0,
          0,
          null,
          createdAt,
          updatedAt
        );

        for (const msg of win.messages) {
          if (!msg || typeof msg !== 'object' || typeof msg.role !== 'string') continue;

          const msgId = msg.id || generateId();
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');

          db.prepare(`
            INSERT OR IGNORE INTO chat_messages (id, window_id, role, content, reasoning_content, reasoning_collapsed, tool_calls, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            msgId,
            win.id,
            msg.role,
            content,
            null,
            0,
            null,
            createdAt
          );

          messageCount++;
        }

        migratedCount++;
      }
    });

    transaction();

    console.log(`[ChatHistory] 迁移完成: ${migratedCount} 个窗口, ${messageCount} 条消息`);
    return { success: true, windowCount: migratedCount, messageCount };
  } catch (err) {
    console.error('[ChatHistory] 迁移失败:', err.message);
    return { success: false, error: err.message };
  }
}

function getStats() {
  const db = getDb();
  if (!db) return { windowCount: 0, messageCount: 0 };

  ensureTables();

  try {
    const windowCount = db.prepare('SELECT COUNT(*) as count FROM chat_windows').get()?.count || 0;
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get()?.count || 0;
    return { windowCount, messageCount };
  } catch (err) {
    console.error('[ChatHistory] 获取统计失败:', err.message);
    return { windowCount: 0, messageCount: 0 };
  }
}

module.exports = {
  ensureTables,
  createWindow,
  listWindows,
  getWindow,
  updateWindow,
  deleteWindow,
  addMessage,
  addMessages,
  getMessages,
  deleteMessage,
  clearMessages,
  searchMessages,
  replaceWindowMessages,
  migrateFromLocalStorage,
  getStats,
};

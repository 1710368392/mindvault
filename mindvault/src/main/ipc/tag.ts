// @ts-nocheck
/**
 * 标签相关 IPC 处理器
 */

const { ipcMain } = require('electron');
const repo = require('../db/repository');
const dataSync = require('../services/data-sync');

function registerTagHandlers() {
  ipcMain.handle('tag:list', () => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
      } catch (e) { return []; }
    } else {
      return repo.JsonStore.get('tags') || [];
    }
  });

  ipcMain.handle('tag:create', (event, data) => {
    const tag = {
      id: repo.generateId(),
      name: data.name,
      color: data.color || '#3B82F6',
      createdAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
          .run(tag.id, tag.name, tag.color, tag.createdAt);
        dataSync.uploadTag(tag).catch(() => {});
        return tag;
      } catch (e) {
        console.error('[IPC] 创建标签失败:', e);
        return null;
      }
    } else {
      repo.JsonStore.get('tags').push(tag);
      repo.JsonStore.save();
      return tag;
    }
  });

  ipcMain.handle('tag:update', (event, id, data) => {
    if (repo.db) {
      try {
        const result = repo.safeBuildUpdate('tags', data);
        if (result) {
          result.values.push(id);
          repo.db.prepare(result.sql).run(...result.values);
        }
        const updated = repo.db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        dataSync.uploadTag(updated).catch(() => {});
        return updated;
      } catch (e) { return null; }
    } else {
      const items = repo.JsonStore.get('tags');
      const idx = items.findIndex(t => t.id === id);
      if (idx >= 0) { items[idx] = { ...items[idx], ...data }; repo.JsonStore.save(); return items[idx]; }
      return null;
    }
  });

  ipcMain.handle('tag:delete', (event, id) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM creativity_tags WHERE tag_id = ?').run(id);
        repo.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        dataSync.deleteTag(id).catch(() => {});
        return true;
      } catch (e) { return false; }
    } else {
      const items = repo.JsonStore.get('tags').filter(t => t.id !== id);
      repo.JsonStore.set('tags', items);
      return true;
    }
  });

  ipcMain.handle('tag:creativities', (event, tagId) => {
    if (repo.db) {
      try {
        return repo.db.prepare(`
          SELECT c.* FROM creativities c
          INNER JOIN creativity_tags ct ON c.id = ct.creativity_id
          WHERE ct.tag_id = ? AND c.status = 'active'
        `).all(tagId);
      } catch (e) { return []; }
    } else {
      return [];
    }
  });

  console.log('[IPC] 标签处理器已注册');
}

module.exports = { registerTagHandlers };

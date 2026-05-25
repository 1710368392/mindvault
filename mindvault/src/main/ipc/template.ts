// @ts-nocheck
/**
 * 模板相关 IPC 处理器
 */

const { ipcMain } = require('electron');
const repo = require('../db/repository');
const dataSync = require('../services/data-sync');

function registerTemplateHandlers() {
  ipcMain.handle('template:list', (event, params = {}) => {
    const { category } = params;
    if (repo.db) {
      try {
        if (category) {
          return repo.db.prepare('SELECT * FROM templates WHERE category = ? ORDER BY name ASC').all(category);
        }
        return repo.db.prepare('SELECT * FROM templates ORDER BY name ASC').all();
      } catch (e) { return []; }
    } else {
      let items = repo.JsonStore.get('templates') || [];
      if (category) items = items.filter(t => t.category === category);
      return items;
    }
  });

  ipcMain.handle('template:create', (event, data) => {
    const template = {
      id: repo.generateId(),
      name: data.name || '新模板',
      category: data.category || 'custom',
      config: JSON.stringify(data.config || {}),
      isBuiltin: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (repo.db) {
      try {
        repo.db.prepare('INSERT INTO templates (id, name, category, config, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(template.id, template.name, template.category, template.config, template.isBuiltin, template.createdAt, template.updatedAt);
        dataSync.uploadTemplate(template).catch(() => {});
        return template;
      } catch (e) { console.error('[IPC] 创建模板失败:', e); return null; }
    } else {
      repo.JsonStore.get('templates').push(template);
      repo.JsonStore.save();
      return template;
    }
  });

  ipcMain.handle('template:read', (event, id) => {
    if (repo.db) {
      try {
        return repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
      } catch (e) { return null; }
    } else {
      return repo.JsonStore.get('templates').find(t => t.id === id) || null;
    }
  });

  ipcMain.handle('template:update', (event, id, data) => {
    data.updatedAt = new Date().toISOString();
    if (repo.db) {
      try {
        const result = repo.safeBuildUpdate('templates', data);
        if (result) {
          result.values.push(id);
          repo.db.prepare(result.sql).run(...result.values);
        }
        return repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
      } catch (e) { console.error('[IPC] 更新模板失败:', e); return null; }
    } else {
      const items = repo.JsonStore.get('templates');
      const idx = items.findIndex(t => t.id === id);
      if (idx >= 0) { items[idx] = { ...items[idx], ...data }; repo.JsonStore.save(); return items[idx]; }
      return null;
    }
  });

  ipcMain.handle('template:delete', (event, id) => {
    if (repo.db) {
      try {
        repo.db.prepare('DELETE FROM templates WHERE id = ? AND is_builtin = 0').run(id);
        dataSync.deleteTemplate(id).catch(() => {});
        return true;
      } catch (e) { return false; }
    } else {
      const items = repo.JsonStore.get('templates').filter(t => !(t.id === id && !t.isBuiltin));
      repo.JsonStore.set('templates', items);
      return true;
    }
  });

  ipcMain.handle('template:apply', (event, templateId, creativityId) => {
    if (repo.db) {
      try {
        const template = repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
        if (!template) return null;
        const config = JSON.parse(template.config || '{}');
        const now = new Date().toISOString();
        repo.db.prepare('UPDATE creativities SET template_id = ?, updated_at = ? WHERE id = ?').run(templateId, now, creativityId);
        return repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(creativityId);
      } catch (e) { console.error('[IPC] 应用模板失败:', e); return null; }
    } else {
      return null;
    }
  });

  console.log('[IPC] 模板处理器已注册');
}

module.exports = { registerTemplateHandlers };

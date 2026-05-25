// @ts-nocheck
/**
 * 搜索相关 IPC 处理器
 */

const { ipcMain } = require('electron');
const repo = require('../db/repository');

function registerSearchHandlers() {
  ipcMain.handle('search:creativities', (event, params = {}) => {
    const { keyword, type, tagId, status = 'active', page = 1, pageSize = 20 } = params;
    if (!keyword && !type && !tagId) return { data: [], pagination: { page, pageSize, total: 0 } };

    if (repo.db) {
      try {
        let sql = 'SELECT c.* FROM creativities c WHERE 1=1';
        const args = [];
        if (status) { sql += ' AND c.status = ?'; args.push(status); }
        if (keyword) { sql += ' AND (c.title LIKE ? OR c.content LIKE ?)'; args.push(`%${keyword}%`, `%${keyword}%`); }
        if (type) { sql += ' AND c.type = ?'; args.push(type); }
        if (tagId) { sql += ' AND EXISTS (SELECT 1 FROM creativity_tags ct WHERE ct.creativity_id = c.id AND ct.tag_id = ?)'; args.push(tagId); }

        sql += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
        args.push(pageSize, (page - 1) * pageSize);

        const items = repo.db.prepare(sql).all(...args);
        const mappedItems = repo.mapRows(items);
        for (const item of mappedItems) {
          try {
            const tagRows = repo.db.prepare(
              'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
            ).all(item.id);
            item.tags = tagRows.map(t => repo.toCamelCase(t));
          } catch (_) {}
        }
        let countSql = 'SELECT COUNT(*) as total FROM creativities c WHERE 1=1';
        const countArgs = [];
        if (status) { countSql += ' AND c.status = ?'; countArgs.push(status); }
        if (keyword) { countSql += ' AND (c.title LIKE ? OR c.content LIKE ?)'; countArgs.push(`%${keyword}%`, `%${keyword}%`); }
        if (type) { countSql += ' AND c.type = ?'; countArgs.push(type); }
        if (tagId) { countSql += ' AND EXISTS (SELECT 1 FROM creativity_tags ct WHERE ct.creativity_id = c.id AND ct.tag_id = ?)'; countArgs.push(tagId); }
        const countResult = repo.db.prepare(countSql).get(...countArgs);
        return { data: mappedItems, pagination: { page, pageSize, total: countResult.total } };
      } catch (e) {
        console.error('[IPC] 搜索创意失败:', e);
        return { data: [], pagination: { page, pageSize, total: 0 } };
      }
    } else {
      let items = repo.JsonStore.get('creativities').filter(c => c.status === status || !status);
      if (keyword) {
        const kw = keyword.toLowerCase();
        items = items.filter(c => (c.title || '').toLowerCase().includes(kw) || (c.content || '').toLowerCase().includes(kw));
      }
      if (type) items = items.filter(c => c.type === type);
      if (tagId) items = items.filter(c => c.tags && c.tags.includes(tagId));
      const start = (page - 1) * pageSize;
      return { data: items.slice(start, start + pageSize), pagination: { page, pageSize, total: items.length } };
    }
  });

  ipcMain.handle('search:suggestions', (event, keyword) => {
    if (!keyword || keyword.length < 1) return [];
    if (repo.db) {
      try {
        return repo.db.prepare("SELECT title, content FROM creativities WHERE status = 'active' AND title LIKE ? LIMIT 8").all(`%${keyword}%`);
      } catch (e) { return []; }
    } else {
      const kw = keyword.toLowerCase();
      return repo.JsonStore.get('creativities')
        .filter(c => c.status === 'active' && (c.title || '').toLowerCase().includes(kw))
        .slice(0, 8)
        .map(c => ({ title: c.title, content: c.content }));
    }
  });

  ipcMain.handle('search:recent-keywords', () => {
    if (repo.db) {
      try {
        const row = repo.db.prepare("SELECT value FROM settings WHERE key = 'recentSearchKeywords'").get();
        if (row) {
          try { return JSON.parse(row.value); } catch (e) { return []; }
        }
        return [];
      } catch (e) { return []; }
    } else {
      const settings = repo.JsonStore.get('settings');
      return settings.recentSearchKeywords || [];
    }
  });

  ipcMain.handle('search:add-recent-keyword', (event, keyword) => {
    if (!keyword) return false;
    if (repo.db) {
      try {
        const row = repo.db.prepare("SELECT value FROM settings WHERE key = 'recentSearchKeywords'").get();
        let keywords = [];
        if (row) { try { keywords = JSON.parse(row.value); } catch (e) {} }
        keywords = keywords.filter(k => k !== keyword).slice(0, 9);
        keywords.unshift(keyword);
        repo.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('recentSearchKeywords', JSON.stringify(keywords));
        return true;
      } catch (e) { return false; }
    } else {
      const settings = repo.JsonStore.get('settings');
      if (!settings.recentSearchKeywords) settings.recentSearchKeywords = [];
      settings.recentSearchKeywords = settings.recentSearchKeywords.filter(k => k !== keyword).slice(0, 9);
      settings.recentSearchKeywords.unshift(keyword);
      repo.JsonStore.save();
      return true;
    }
  });

  ipcMain.handle('search:clear-recent-keywords', () => {
    if (repo.db) {
      try {
        repo.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('recentSearchKeywords', JSON.stringify([]));
        return true;
      } catch (e) { return false; }
    } else {
      const settings = repo.JsonStore.get('settings');
      settings.recentSearchKeywords = [];
      repo.JsonStore.save();
      return true;
    }
  });

  console.log('[IPC] 搜索处理器已注册');
}

module.exports = { registerSearchHandlers };

"use strict";
// @ts-nocheck
/**
 * 搜索相关 IPC 处理器
 */
var ipcMain = require('electron').ipcMain;
var repo = require('../db/repository');
function registerSearchHandlers() {
    ipcMain.handle('search:creativities', function (event, params) {
        var _a, _b;
        if (params === void 0) { params = {}; }
        var keyword = params.keyword, type = params.type, tagId = params.tagId, _c = params.status, status = _c === void 0 ? 'active' : _c, _d = params.page, page = _d === void 0 ? 1 : _d, _e = params.pageSize, pageSize = _e === void 0 ? 20 : _e;
        if (!keyword && !type && !tagId)
            return { data: [], pagination: { page: page, pageSize: pageSize, total: 0 } };
        if (repo.db) {
            try {
                var sql = 'SELECT c.* FROM creativities c WHERE 1=1';
                var args = [];
                if (status) {
                    sql += ' AND c.status = ?';
                    args.push(status);
                }
                if (keyword) {
                    sql += ' AND (c.title LIKE ? OR c.content LIKE ?)';
                    args.push("%".concat(keyword, "%"), "%".concat(keyword, "%"));
                }
                if (type) {
                    sql += ' AND c.type = ?';
                    args.push(type);
                }
                if (tagId) {
                    sql += ' AND EXISTS (SELECT 1 FROM creativity_tags ct WHERE ct.creativity_id = c.id AND ct.tag_id = ?)';
                    args.push(tagId);
                }
                sql += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
                args.push(pageSize, (page - 1) * pageSize);
                var items = (_a = repo.db.prepare(sql)).all.apply(_a, args);
                var mappedItems = repo.mapRows(items);
                for (var _i = 0, mappedItems_1 = mappedItems; _i < mappedItems_1.length; _i++) {
                    var item = mappedItems_1[_i];
                    try {
                        var tagRows = repo.db.prepare('SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?').all(item.id);
                        item.tags = tagRows.map(function (t) { return repo.toCamelCase(t); });
                    }
                    catch (_) { }
                }
                var countSql = 'SELECT COUNT(*) as total FROM creativities c WHERE 1=1';
                var countArgs = [];
                if (status) {
                    countSql += ' AND c.status = ?';
                    countArgs.push(status);
                }
                if (keyword) {
                    countSql += ' AND (c.title LIKE ? OR c.content LIKE ?)';
                    countArgs.push("%".concat(keyword, "%"), "%".concat(keyword, "%"));
                }
                if (type) {
                    countSql += ' AND c.type = ?';
                    countArgs.push(type);
                }
                if (tagId) {
                    countSql += ' AND EXISTS (SELECT 1 FROM creativity_tags ct WHERE ct.creativity_id = c.id AND ct.tag_id = ?)';
                    countArgs.push(tagId);
                }
                var countResult = (_b = repo.db.prepare(countSql)).get.apply(_b, countArgs);
                return { data: mappedItems, pagination: { page: page, pageSize: pageSize, total: countResult.total } };
            }
            catch (e) {
                console.error('[IPC] 搜索创意失败:', e);
                return { data: [], pagination: { page: page, pageSize: pageSize, total: 0 } };
            }
        }
        else {
            var items = repo.JsonStore.get('creativities').filter(function (c) { return c.status === status || !status; });
            if (keyword) {
                var kw_1 = keyword.toLowerCase();
                items = items.filter(function (c) { return (c.title || '').toLowerCase().includes(kw_1) || (c.content || '').toLowerCase().includes(kw_1); });
            }
            if (type)
                items = items.filter(function (c) { return c.type === type; });
            if (tagId)
                items = items.filter(function (c) { return c.tags && c.tags.includes(tagId); });
            var start = (page - 1) * pageSize;
            return { data: items.slice(start, start + pageSize), pagination: { page: page, pageSize: pageSize, total: items.length } };
        }
    });
    ipcMain.handle('search:suggestions', function (event, keyword) {
        if (!keyword || keyword.length < 1)
            return [];
        if (repo.db) {
            try {
                return repo.db.prepare("SELECT title, content FROM creativities WHERE status = 'active' AND title LIKE ? LIMIT 8").all("%".concat(keyword, "%"));
            }
            catch (e) {
                return [];
            }
        }
        else {
            var kw_2 = keyword.toLowerCase();
            return repo.JsonStore.get('creativities')
                .filter(function (c) { return c.status === 'active' && (c.title || '').toLowerCase().includes(kw_2); })
                .slice(0, 8)
                .map(function (c) { return ({ title: c.title, content: c.content }); });
        }
    });
    ipcMain.handle('search:recent-keywords', function () {
        if (repo.db) {
            try {
                var row = repo.db.prepare("SELECT value FROM settings WHERE key = 'recentSearchKeywords'").get();
                if (row) {
                    try {
                        return JSON.parse(row.value);
                    }
                    catch (e) {
                        return [];
                    }
                }
                return [];
            }
            catch (e) {
                return [];
            }
        }
        else {
            var settings = repo.JsonStore.get('settings');
            return settings.recentSearchKeywords || [];
        }
    });
    ipcMain.handle('search:add-recent-keyword', function (event, keyword) {
        if (!keyword)
            return false;
        if (repo.db) {
            try {
                var row = repo.db.prepare("SELECT value FROM settings WHERE key = 'recentSearchKeywords'").get();
                var keywords = [];
                if (row) {
                    try {
                        keywords = JSON.parse(row.value);
                    }
                    catch (e) { }
                }
                keywords = keywords.filter(function (k) { return k !== keyword; }).slice(0, 9);
                keywords.unshift(keyword);
                repo.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('recentSearchKeywords', JSON.stringify(keywords));
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var settings = repo.JsonStore.get('settings');
            if (!settings.recentSearchKeywords)
                settings.recentSearchKeywords = [];
            settings.recentSearchKeywords = settings.recentSearchKeywords.filter(function (k) { return k !== keyword; }).slice(0, 9);
            settings.recentSearchKeywords.unshift(keyword);
            repo.JsonStore.save();
            return true;
        }
    });
    ipcMain.handle('search:clear-recent-keywords', function () {
        if (repo.db) {
            try {
                repo.db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run('recentSearchKeywords', JSON.stringify([]));
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var settings = repo.JsonStore.get('settings');
            settings.recentSearchKeywords = [];
            repo.JsonStore.save();
            return true;
        }
    });
    console.log('[IPC] 搜索处理器已注册');
}
module.exports = { registerSearchHandlers: registerSearchHandlers };

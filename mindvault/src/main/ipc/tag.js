"use strict";
// @ts-nocheck
/**
 * 标签相关 IPC 处理器
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var ipcMain = require('electron').ipcMain;
var repo = require('../db/repository');
function registerTagHandlers() {
    ipcMain.handle('tag:list', function () {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM tags ORDER BY name ASC').all();
            }
            catch (e) {
                return [];
            }
        }
        else {
            return repo.JsonStore.get('tags') || [];
        }
    });
    ipcMain.handle('tag:create', function (event, data) {
        var tag = {
            id: repo.generateId(),
            name: data.name,
            color: data.color || '#3B82F6',
            createdAt: new Date().toISOString(),
        };
        if (repo.db) {
            try {
                repo.db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)')
                    .run(tag.id, tag.name, tag.color, tag.createdAt);
                return tag;
            }
            catch (e) {
                console.error('[IPC] 创建标签失败:', e);
                return null;
            }
        }
        else {
            repo.JsonStore.get('tags').push(tag);
            repo.JsonStore.save();
            return tag;
        }
    });
    ipcMain.handle('tag:update', function (event, id, data) {
        var _a;
        if (repo.db) {
            try {
                var fields = [];
                var values = [];
                for (var _i = 0, _b = Object.entries(data); _i < _b.length; _i++) {
                    var _c = _b[_i], key = _c[0], val = _c[1];
                    var col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                    fields.push("".concat(col, " = ?"));
                    values.push(val);
                }
                values.push(id);
                (_a = repo.db.prepare("UPDATE tags SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                return repo.db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
            }
            catch (e) {
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('tags');
            var idx = items.findIndex(function (t) { return t.id === id; });
            if (idx >= 0) {
                items[idx] = __assign(__assign({}, items[idx]), data);
                repo.JsonStore.save();
                return items[idx];
            }
            return null;
        }
    });
    ipcMain.handle('tag:delete', function (event, id) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM creativity_tags WHERE tag_id = ?').run(id);
                repo.db.prepare('DELETE FROM tags WHERE id = ?').run(id);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('tags').filter(function (t) { return t.id !== id; });
            repo.JsonStore.set('tags', items);
            return true;
        }
    });
    ipcMain.handle('tag:creativities', function (event, tagId) {
        if (repo.db) {
            try {
                return repo.db.prepare("\n          SELECT c.* FROM creativities c\n          INNER JOIN creativity_tags ct ON c.id = ct.creativity_id\n          WHERE ct.tag_id = ? AND c.status = 'active'\n        ").all(tagId);
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    console.log('[IPC] 标签处理器已注册');
}
module.exports = { registerTagHandlers: registerTagHandlers };

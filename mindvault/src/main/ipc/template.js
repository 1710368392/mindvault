"use strict";
// @ts-nocheck
/**
 * 模板相关 IPC 处理器
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
function registerTemplateHandlers() {
    ipcMain.handle('template:list', function (event, params) {
        if (params === void 0) { params = {}; }
        var category = params.category;
        if (repo.db) {
            try {
                if (category) {
                    return repo.db.prepare('SELECT * FROM templates WHERE category = ? ORDER BY name ASC').all(category);
                }
                return repo.db.prepare('SELECT * FROM templates ORDER BY name ASC').all();
            }
            catch (e) {
                return [];
            }
        }
        else {
            var items = repo.JsonStore.get('templates') || [];
            if (category)
                items = items.filter(function (t) { return t.category === category; });
            return items;
        }
    });
    ipcMain.handle('template:create', function (event, data) {
        var template = {
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
                return template;
            }
            catch (e) {
                console.error('[IPC] 创建模板失败:', e);
                return null;
            }
        }
        else {
            repo.JsonStore.get('templates').push(template);
            repo.JsonStore.save();
            return template;
        }
    });
    ipcMain.handle('template:read', function (event, id) {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
            }
            catch (e) {
                return null;
            }
        }
        else {
            return repo.JsonStore.get('templates').find(function (t) { return t.id === id; }) || null;
        }
    });
    ipcMain.handle('template:update', function (event, id, data) {
        var _a;
        data.updatedAt = new Date().toISOString();
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
                (_a = repo.db.prepare("UPDATE templates SET ".concat(fields.join(', '), " WHERE id = ?"))).run.apply(_a, values);
                return repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
            }
            catch (e) {
                console.error('[IPC] 更新模板失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('templates');
            var idx = items.findIndex(function (t) { return t.id === id; });
            if (idx >= 0) {
                items[idx] = __assign(__assign({}, items[idx]), data);
                repo.JsonStore.save();
                return items[idx];
            }
            return null;
        }
    });
    ipcMain.handle('template:delete', function (event, id) {
        if (repo.db) {
            try {
                repo.db.prepare('DELETE FROM templates WHERE id = ? AND is_builtin = 0').run(id);
                return true;
            }
            catch (e) {
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('templates').filter(function (t) { return !(t.id === id && !t.isBuiltin); });
            repo.JsonStore.set('templates', items);
            return true;
        }
    });
    ipcMain.handle('template:apply', function (event, templateId, creativityId) {
        if (repo.db) {
            try {
                var template = repo.db.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
                if (!template)
                    return null;
                var config = JSON.parse(template.config || '{}');
                var now = new Date().toISOString();
                repo.db.prepare('UPDATE creativities SET template_id = ?, updated_at = ? WHERE id = ?').run(templateId, now, creativityId);
                return repo.db.prepare('SELECT * FROM creativities WHERE id = ?').get(creativityId);
            }
            catch (e) {
                console.error('[IPC] 应用模板失败:', e);
                return null;
            }
        }
        else {
            return null;
        }
    });
    console.log('[IPC] 模板处理器已注册');
}
module.exports = { registerTemplateHandlers: registerTemplateHandlers };

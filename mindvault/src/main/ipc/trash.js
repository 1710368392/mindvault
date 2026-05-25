"use strict";
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
// @ts-nocheck
var ipcMain = require('electron').ipcMain;
var fs = require('fs');
var repo = require('../db/repository');
var deleteCreativityMedia = require('./creativity').deleteCreativityMedia;
function registerTrashHandlers() {
    ipcMain.handle('trash:list', function () {
        if (repo.db) {
            try {
                var results = repo.db.prepare('SELECT * FROM trash_items ORDER BY deleted_at DESC').all();
                return repo.mapRows(results).map(function (item) { return (__assign(__assign({}, item), { snapshot: JSON.parse(item.snapshot) })); });
            }
            catch (e) {
                console.error('[IPC] 获取回收站列表失败:', e);
                return [];
            }
        }
        else {
            try {
                var items = repo.JsonStore.get('trashItems') || [];
                return items.map(function (item) { return (__assign(__assign({}, item), { snapshot: typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : item.snapshot })); });
            }
            catch (e) {
                return [];
            }
        }
    });
    ipcMain.handle('trash:add', function (event, data) {
        var now = new Date().toISOString();
        var id = repo.generateId();
        var snapshot = typeof data.snapshot === 'string' ? data.snapshot : JSON.stringify(data.snapshot);
        if (repo.db) {
            try {
                repo.db.prepare('INSERT INTO trash_items (id, item_type, item_id, source_board_id, source_board_name, snapshot, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                    .run(id, data.itemType, data.itemId, data.sourceBoardId || null, data.sourceBoardName || null, snapshot, now);
                return { id: id, itemType: data.itemType, itemId: data.itemId, sourceBoardId: data.sourceBoardId || null, sourceBoardName: data.sourceBoardName || null, snapshot: data.snapshot, deletedAt: now };
            }
            catch (e) {
                console.error('[IPC] 添加回收站项失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('trashItems') || [];
            var item = { id: id, itemType: data.itemType, itemId: data.itemId, sourceBoardId: data.sourceBoardId || null, sourceBoardName: data.sourceBoardName || null, snapshot: data.snapshot, deletedAt: now };
            items.push(item);
            repo.JsonStore.set('trashItems', items);
            repo.JsonStore.save();
            return item;
        }
    });
    ipcMain.handle('trash:restore', function (event, trashItemId) {
        if (repo.db) {
            try {
                var item = repo.db.prepare('SELECT * FROM trash_items WHERE id = ?').get(trashItemId);
                if (!item)
                    return null;
                var parsed = repo.toCamelCase(item);
                parsed.snapshot = JSON.parse(parsed.snapshot);
                repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
                return parsed;
            }
            catch (e) {
                console.error('[IPC] 恢复回收站项失败:', e);
                return null;
            }
        }
        else {
            var items = repo.JsonStore.get('trashItems') || [];
            var idx = items.findIndex(function (i) { return i.id === trashItemId; });
            if (idx === -1)
                return null;
            var item = items.splice(idx, 1)[0];
            item.snapshot = typeof item.snapshot === 'string' ? JSON.parse(item.snapshot) : item.snapshot;
            repo.JsonStore.set('trashItems', items);
            repo.JsonStore.save();
            return item;
        }
    });
    ipcMain.handle('trash:permanent-delete', function (event, trashItemId) {
        if (repo.db) {
            try {
                var item = repo.db.prepare('SELECT item_type, item_id FROM trash_items WHERE id = ?').get(trashItemId);
                if (item && item.item_type === 'creativity' && item.item_id) {
                    try {
                        deleteCreativityMedia(repo.db, item.item_id);
                    }
                    catch (e) {
                        console.error('[IPC] 清理创意媒体失败:', e);
                    }
                }
                repo.db.prepare('DELETE FROM trash_items WHERE id = ?').run(trashItemId);
                return true;
            }
            catch (e) {
                console.error('[IPC] 永久删除回收站项失败:', e);
                return false;
            }
        }
        else {
            var items = repo.JsonStore.get('trashItems') || [];
            repo.JsonStore.set('trashItems', items.filter(function (i) { return i.id !== trashItemId; }));
            repo.JsonStore.save();
            return true;
        }
    });
    ipcMain.handle('trash:clear', function () {
        if (repo.db) {
            try {
                var creativityItems = repo.db.prepare("SELECT item_id FROM trash_items WHERE item_type = 'creativity'").all();
                for (var _i = 0, creativityItems_1 = creativityItems; _i < creativityItems_1.length; _i++) {
                    var item = creativityItems_1[_i];
                    try {
                        deleteCreativityMedia(repo.db, item.item_id);
                    }
                    catch (e) {
                        console.error('[IPC] 清理创意媒体失败:', e);
                    }
                }
                repo.db.prepare('DELETE FROM trash_items').run();
                return true;
            }
            catch (e) {
                console.error('[IPC] 清空回收站失败:', e);
                return false;
            }
        }
        else {
            repo.JsonStore.set('trashItems', []);
            repo.JsonStore.save();
            return true;
        }
    });
    ipcMain.handle('trash:check-board-exists', function (event, boardId) {
        if (repo.db) {
            try {
                var board = repo.db.prepare('SELECT id, name FROM boards WHERE id = ?').get(boardId);
                return board ? repo.toCamelCase(board) : null;
            }
            catch (e) {
                return null;
            }
        }
        else {
            var boards = repo.JsonStore.get('boards') || [];
            return boards.find(function (b) { return b.id === boardId; }) || null;
        }
    });
}
module.exports = { registerTrashHandlers: registerTrashHandlers };

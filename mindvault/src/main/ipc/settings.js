"use strict";
// @ts-nocheck
/**
 * 设置相关 IPC 处理器
 */
var ipcMain = require('electron').ipcMain;
var repo = require('../db/repository');
function parseSettingValue(rawValue) {
    try {
        var parsed = JSON.parse(rawValue);
        if (parsed === 'true')
            return true;
        if (parsed === 'false')
            return false;
        return parsed;
    }
    catch (e) {
        return rawValue;
    }
}
function registerSettingsHandlers() {
    ipcMain.handle('settings:get', function (event, key) {
        if (repo.db) {
            try {
                var row = repo.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
                if (row) {
                    return parseSettingValue(row.value);
                }
                return null;
            }
            catch (e) {
                return null;
            }
        }
        else {
            var settings = repo.JsonStore.get('settings');
            return settings[key] || null;
        }
    });
    ipcMain.handle('settings:set', function (event, key, value) {
        if (repo.db) {
            try {
                var jsonValue = JSON.stringify(value);
                repo.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, jsonValue);
                return true;
            }
            catch (e) {
                console.error('[IPC] 保存设置失败:', e);
                return false;
            }
        }
        else {
            var settings = repo.JsonStore.get('settings');
            settings[key] = value;
            repo.JsonStore.save();
            return true;
        }
    });
    ipcMain.handle('settings:get-all', function () {
        if (repo.db) {
            try {
                var rows = repo.db.prepare('SELECT key, value FROM settings').all();
                var result = {};
                for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                    var row = rows_1[_i];
                    result[row.key] = parseSettingValue(row.value);
                }
                return result;
            }
            catch (e) {
                return {};
            }
        }
        else {
            return repo.JsonStore.get('settings') || {};
        }
    });
    console.log('[IPC] 设置处理器已注册');
}
module.exports = { registerSettingsHandlers: registerSettingsHandlers };

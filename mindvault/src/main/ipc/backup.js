"use strict";
// @ts-nocheck
/**
 * 备份相关 IPC 处理器
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a = require('electron'), ipcMain = _a.ipcMain, dialog = _a.dialog;
var path = require('path');
var fs = require('fs');
var archiver = require('archiver');
var extractZip = require('extract-zip');
var repo = require('../db/repository');
function registerBackupHandlers() {
    var _this = this;
    ipcMain.handle('backup:create', function () { return __awaiter(_this, void 0, void 0, function () {
        var timestamp, backupFilename, backupFilePath, output, archive, dataDir, backupRecord, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('+')[0];
                    backupFilename = "mindvault_backup_".concat(timestamp, ".zip");
                    backupFilePath = path.join(repo.backupDir, backupFilename);
                    repo.ensureDir(repo.backupDir);
                    output = fs.createWriteStream(backupFilePath);
                    archive = archiver('zip', { zlib: { level: 9 } });
                    archive.pipe(output);
                    dataDir = repo.userDataPath;
                    if (fs.existsSync(dataDir)) {
                        archive.directory(dataDir, 'data');
                    }
                    return [4 /*yield*/, archive.finalize()];
                case 1:
                    _a.sent();
                    backupRecord = {
                        id: repo.generateId(),
                        filename: backupFilename,
                        filePath: backupFilePath,
                        size: fs.statSync(backupFilePath).size,
                        createdAt: new Date().toISOString(),
                    };
                    if (repo.db) {
                        repo.db.prepare('INSERT INTO backups (id, filename, file_path, size, created_at) VALUES (?, ?, ?, ?, ?)')
                            .run(backupRecord.id, backupRecord.filename, backupRecord.filePath, backupRecord.size, backupRecord.createdAt);
                    }
                    return [2 /*return*/, { success: true, data: backupRecord }];
                case 2:
                    e_1 = _a.sent();
                    console.error('[IPC] 创建备份失败:', e_1);
                    return [2 /*return*/, { success: false, error: e_1.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('backup:list', function () {
        if (repo.db) {
            try {
                return repo.db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all();
            }
            catch (e) {
                return [];
            }
        }
        else {
            return [];
        }
    });
    ipcMain.handle('backup:restore', function (event, backupId) { return __awaiter(_this, void 0, void 0, function () {
        function copyRecursive(src, dest) {
            var stat = fs.statSync(src);
            if (stat.isDirectory()) {
                fs.mkdirSync(dest, { recursive: true });
                for (var _i = 0, _a = fs.readdirSync(src); _i < _a.length; _i++) {
                    var entry = _a[_i];
                    copyRecursive(path.join(src, entry), path.join(dest, entry));
                }
            }
            else {
                fs.copyFileSync(src, dest);
            }
        }
        var backupPath, record, tempRestoreDir, sourceDataDir, targetDataDir, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    backupPath = '';
                    if (repo.db) {
                        record = repo.db.prepare('SELECT file_path FROM backups WHERE id = ?').get(backupId);
                        if (!record)
                            throw new Error('备份记录不存在');
                        backupPath = record.file_path;
                    }
                    else {
                        throw new Error('JSON模式不支持恢复');
                    }
                    if (!fs.existsSync(backupPath))
                        throw new Error('备份文件不存在');
                    tempRestoreDir = path.join(repo.backupDir, 'temp_restore_' + Date.now());
                    repo.ensureDir(tempRestoreDir);
                    return [4 /*yield*/, extractZip(backupPath, { dir: tempRestoreDir })];
                case 1:
                    _a.sent();
                    sourceDataDir = path.join(tempRestoreDir, 'data');
                    if (!fs.existsSync(sourceDataDir))
                        throw new Error('备份数据格式不正确');
                    targetDataDir = repo.userDataPath;
                    repo.ensureDir(targetDataDir);
                    copyRecursive(sourceDataDir, targetDataDir);
                    fs.rmSync(tempRestoreDir, { recursive: true, force: true });
                    return [2 /*return*/, { success: true, message: '数据已成功恢复，请重启应用' }];
                case 2:
                    e_2 = _a.sent();
                    console.error('[IPC] 恢复备份失败:', e_2);
                    return [2 /*return*/, { success: false, error: e_2.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('backup:export-to-file', function (event_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([event_1], args_1, true), void 0, function (event, format) {
            var result, exportPath, exportData, csvContent, rows, _a, rows_1, row, items, _b, items_1, item, e_3;
            if (format === void 0) { format = 'json'; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, dialog.showSaveDialog({
                                defaultPath: "mindvault_export.".concat(format),
                                filters: [
                                    { name: 'JSON 文件', extensions: ['json'] },
                                    { name: 'CSV 文件', extensions: ['csv'] },
                                    { name: '所有文件', extensions: ['*'] },
                                ],
                            })];
                    case 1:
                        result = _c.sent();
                        if (result.canceled)
                            return [2 /*return*/, { success: false, canceled: true }];
                        exportPath = result.filePath;
                        if (format === 'json') {
                            exportData = {};
                            if (repo.db) {
                                exportData.creativities = repo.db.prepare("SELECT * FROM creativities WHERE status != 'trashed'").all();
                                exportData.tags = repo.db.prepare('SELECT * FROM tags').all();
                                exportData.boards = repo.db.prepare('SELECT * FROM boards').all();
                                exportData.templates = repo.db.prepare('SELECT * FROM templates').all();
                                exportData.exportedAt = new Date().toISOString();
                            }
                            else {
                                exportData.creativities = repo.JsonStore.get('creativities').filter(function (c) { return c.status !== 'trashed'; });
                                exportData.tags = repo.JsonStore.get('tags');
                                exportData.boards = repo.JsonStore.get('boards');
                                exportData.templates = repo.JsonStore.get('templates');
                                exportData.exportedAt = new Date().toISOString();
                            }
                            fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
                        }
                        else if (format === 'csv') {
                            csvContent = 'ID,标题,内容,类型,状态,优先级,标签,创建时间\n';
                            if (repo.db) {
                                rows = repo.db.prepare("SELECT * FROM creativities WHERE status != 'trashed'").all();
                                for (_a = 0, rows_1 = rows; _a < rows_1.length; _a++) {
                                    row = rows_1[_a];
                                    csvContent += "".concat(row.id, ",\"").concat((row.title || '').replace(/"/g, '""'), "\",\"").concat(((row.content || '').substring(0, 100)).replace(/"/g, '""'), "\",").concat(row.type, ",").concat(row.status, ",").concat(row.priority || 0, ",,").concat(row.created_at, "\n");
                                }
                            }
                            else {
                                items = repo.JsonStore.get('creativities').filter(function (c) { return c.status !== 'trashed'; });
                                for (_b = 0, items_1 = items; _b < items_1.length; _b++) {
                                    item = items_1[_b];
                                    csvContent += "".concat(item.id, ",\"").concat((item.title || '').replace(/"/g, '""'), "\",\"").concat(((item.content || '').substring(0, 100)).replace(/"/g, '""'), "\",").concat(item.type, ",").concat(item.status, ",").concat(item.priority || 0, ",,").concat(item.createdAt, "\n");
                                }
                            }
                            fs.writeFileSync(exportPath, '\uFEFF' + csvContent);
                        }
                        return [2 /*return*/, { success: true, message: "\u5BFC\u51FA\u6210\u529F: ".concat(exportPath) }];
                    case 2:
                        e_3 = _c.sent();
                        console.error('[IPC] 导出失败:', e_3);
                        return [2 /*return*/, { success: false, error: e_3.message }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    });
    ipcMain.handle('backup:import-from-file', function () { return __awaiter(_this, void 0, void 0, function () {
        var result, importPath, rawData, importData, importedCount, _i, _a, item, newId, now, _b, _c, item, newItem, e_4;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, dialog.showOpenDialog({
                            properties: ['openFile'],
                            filters: [
                                { name: 'JSON 文件', extensions: ['json'] },
                                { name: '所有文件', extensions: ['*'] },
                            ],
                        })];
                case 1:
                    result = _d.sent();
                    if (result.canceled || result.filePaths.length === 0) {
                        return [2 /*return*/, { success: false, canceled: true }];
                    }
                    importPath = result.filePaths[0];
                    rawData = fs.readFileSync(importPath, 'utf-8');
                    importData = JSON.parse(rawData);
                    importedCount = 0;
                    if (repo.db) {
                        if (Array.isArray(importData.creativities)) {
                            for (_i = 0, _a = importData.creativities; _i < _a.length; _i++) {
                                item = _a[_i];
                                newId = repo.generateId();
                                now = new Date().toISOString();
                                repo.db.prepare("INSERT INTO creativities (id, title, content, type, priority, emoji_reaction, status, template_id, board_id, position_x, position_y, card_style, created_at, updated_at, is_read)\n              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(newId, item.title || '导入的创意', item.content || '', item.type || 'text', item.priority || 0, item.emojiReaction || null, 'active', item.templateId || null, item.boardId || null, item.positionX || null, item.positionY || null, item.cardStyle || null, item.createdAt || now, now, 0);
                                importedCount++;
                            }
                        }
                    }
                    else {
                        if (Array.isArray(importData.creativities)) {
                            for (_b = 0, _c = importData.creativities; _b < _c.length; _b++) {
                                item = _c[_b];
                                newItem = __assign(__assign({}, item), { id: repo.generateId(), status: 'active', createdAt: item.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
                                delete newItem.is_favorite;
                                repo.JsonStore.get('creativities').push(newItem);
                                importedCount++;
                            }
                            repo.JsonStore.save();
                        }
                    }
                    return [2 /*return*/, { success: true, data: { imported_count: importedCount }, message: "\u6210\u529F\u5BFC\u5165 ".concat(importedCount, " \u6761\u521B\u610F") }];
                case 2:
                    e_4 = _d.sent();
                    console.error('[IPC] 导入失败:', e_4);
                    return [2 /*return*/, { success: false, error: e_4.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('backup:delete', function (event, backupId) {
        if (repo.db) {
            try {
                var record = repo.db.prepare('SELECT file_path FROM backups WHERE id = ?').get(backupId);
                if (record && record.file_path && fs.existsSync(record.file_path)) {
                    fs.unlinkSync(record.file_path);
                }
                repo.db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
                return { success: true };
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        }
        else {
            return { success: false, error: 'JSON模式不支持删除备份' };
        }
    });
    ipcMain.handle('backup:auto', function (event, config) {
        var _a, _b, _c, _d;
        if (config) {
            // 设置自动备份配置 - 单位统一为分钟（前端显示分钟，后端用分钟）
            var configPath = path.join(repo.backupDir, 'auto_backup_config.json');
            try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                return { success: true, data: config };
            }
            catch (e) {
                console.error('[IPC] 保存自动备份配置失败:', e);
                return { success: false, error: e.message };
            }
        }
        else {
            // 获取当前自动备份配置 - 默认间隔30分钟
            var configPath = path.join(repo.backupDir, 'auto_backup_config.json');
            try {
                if (fs.existsSync(configPath)) {
                    var content = fs.readFileSync(configPath, 'utf-8');
                    var data = JSON.parse(content);
                    // 确保单位统一
                    return { success: true, data: {
                            enabled: (_a = data.enabled) !== null && _a !== void 0 ? _a : false,
                            interval_minutes: (_c = (_b = data.interval_minutes) !== null && _b !== void 0 ? _b : data.interval_hours) !== null && _c !== void 0 ? _c : 30,
                            max_count: (_d = data.max_count) !== null && _d !== void 0 ? _d : 10
                        } };
                }
                else {
                    // 默认配置
                    return { success: true, data: {
                            enabled: false,
                            interval_minutes: 30,
                            max_count: 10
                        } };
                }
            }
            catch (e) {
                console.error('[IPC] 读取自动备份配置失败:', e);
                return { success: false, error: e.message };
            }
        }
    });
    console.log('[IPC] 备份处理器已注册');
}
module.exports = { registerBackupHandlers: registerBackupHandlers };

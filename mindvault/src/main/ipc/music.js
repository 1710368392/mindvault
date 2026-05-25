"use strict";
// @ts-nocheck
/**
 * 音乐库 IPC 处理器
 * 注册音乐相关的 IPC 通道
 */
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
var ipcMain = require('electron').ipcMain;
var musicLibrary = require('../services/music-library');
function registerMusicHandlers() {
    var _this = this;
    // 导入多个音频文件
    ipcMain.handle('music:import-files', function (_event, filePaths) { return __awaiter(_this, void 0, void 0, function () {
        var tracks, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, musicLibrary.importFiles(filePaths)];
                case 1:
                    tracks = _a.sent();
                    return [2 /*return*/, { success: true, data: tracks }];
                case 2:
                    e_1 = _a.sent();
                    console.error('[IPC:音乐] 导入文件失败:', e_1);
                    return [2 /*return*/, { success: false, error: e_1.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 获取所有曲目
    ipcMain.handle('music:get-all-tracks', function () { return __awaiter(_this, void 0, void 0, function () {
        var tracks;
        return __generator(this, function (_a) {
            try {
                tracks = musicLibrary.getAllTracks();
                return [2 /*return*/, { success: true, data: tracks }];
            }
            catch (e) {
                console.error('[IPC:音乐] 获取所有曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 获取单个曲目
    ipcMain.handle('music:get-track', function (_event, id) { return __awaiter(_this, void 0, void 0, function () {
        var track;
        return __generator(this, function (_a) {
            try {
                track = musicLibrary.getTrack(id);
                return [2 /*return*/, { success: true, data: track }];
            }
            catch (e) {
                console.error('[IPC:音乐] 获取曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 删除曲目
    ipcMain.handle('music:delete-track', function (_event, id) { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            try {
                result = musicLibrary.deleteTrack(id);
                return [2 /*return*/, { success: true, data: result }];
            }
            catch (e) {
                console.error('[IPC:音乐] 删除曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 搜索曲目
    ipcMain.handle('music:search-tracks', function (_event, query) { return __awaiter(_this, void 0, void 0, function () {
        var tracks;
        return __generator(this, function (_a) {
            try {
                tracks = musicLibrary.searchTracks(query);
                return [2 /*return*/, { success: true, data: tracks }];
            }
            catch (e) {
                console.error('[IPC:音乐] 搜索曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 切换收藏
    ipcMain.handle('music:toggle-favorite', function (_event, id) { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            try {
                result = musicLibrary.toggleFavorite(id);
                return [2 /*return*/, { success: true, data: result }];
            }
            catch (e) {
                console.error('[IPC:音乐] 切换收藏失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 获取收藏曲目
    ipcMain.handle('music:get-favorites', function () { return __awaiter(_this, void 0, void 0, function () {
        var tracks;
        return __generator(this, function (_a) {
            try {
                tracks = musicLibrary.getFavorites();
                return [2 /*return*/, { success: true, data: tracks }];
            }
            catch (e) {
                console.error('[IPC:音乐] 获取收藏曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 更新曲目信息
    ipcMain.handle('music:update-track', function (_event, id, updates) { return __awaiter(_this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            try {
                result = musicLibrary.updateTrack(id, updates);
                return [2 /*return*/, { success: true, data: result }];
            }
            catch (e) {
                console.error('[IPC:音乐] 更新曲目失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 读取音频文件元数据（不导入）
    ipcMain.handle('music:read-metadata', function (_event, filePath) { return __awaiter(_this, void 0, void 0, function () {
        var metadata, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, musicLibrary.readMetadata(filePath)];
                case 1:
                    metadata = _a.sent();
                    return [2 /*return*/, { success: true, data: metadata }];
                case 2:
                    e_2 = _a.sent();
                    console.error('[IPC:音乐] 读取元数据失败:', e_2);
                    return [2 /*return*/, { success: false, error: e_2.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    console.log('[IPC] 音乐库处理器注册完成');
}
module.exports = { registerMusicHandlers: registerMusicHandlers };

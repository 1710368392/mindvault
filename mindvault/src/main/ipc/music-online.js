"use strict";
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
// @ts-nocheck
var ipcMain = require('electron').ipcMain;
var musicOnline = require('../services/music-online');
var qqLogin = require('../services/qq-login');
function registerMusicOnlineHandlers() {
    var _this = this;
    // 搜索歌曲
    ipcMain.handle('music-online:search', function (_event, params) { return __awaiter(_this, void 0, void 0, function () {
        var _a, keyword, page, limit, result, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    _a = params || {}, keyword = _a.keyword, page = _a.page, limit = _a.limit;
                    return [4 /*yield*/, musicOnline.searchSongs(keyword, page, limit)];
                case 1:
                    result = _b.sent();
                    return [2 /*return*/, { success: true, data: result }];
                case 2:
                    e_1 = _b.sent();
                    return [2 /*return*/, { success: false, error: e_1.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 获取播放链接
    ipcMain.handle('music-online:get-url', function (_event, params) { return __awaiter(_this, void 0, void 0, function () {
        var songmid, url, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    songmid = (params || {}).songmid;
                    return [4 /*yield*/, musicOnline.getSongUrl(songmid)];
                case 1:
                    url = _a.sent();
                    return [2 /*return*/, { success: true, data: { url: url } }];
                case 2:
                    e_2 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_2.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 获取歌词
    ipcMain.handle('music-online:get-lyric', function (_event, songmid) { return __awaiter(_this, void 0, void 0, function () {
        var result, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, musicOnline.getLyric(songmid)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, { success: true, data: result }];
                case 2:
                    e_3 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_3.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 获取歌曲详情
    ipcMain.handle('music-online:get-detail', function (_event, songmids) { return __awaiter(_this, void 0, void 0, function () {
        var result, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, musicOnline.getSongDetail(songmids)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, { success: true, data: result }];
                case 2:
                    e_4 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_4.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 设置 Cookie
    ipcMain.handle('music-online:set-cookie', function (_event, cookie) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                musicOnline.setCookie(cookie);
                return [2 /*return*/, { success: true }];
            }
            catch (e) {
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 获取 Cookie
    ipcMain.handle('music-online:get-cookie', function () { return __awaiter(_this, void 0, void 0, function () {
        var cookie;
        return __generator(this, function (_a) {
            try {
                cookie = musicOnline.getCookie();
                return [2 /*return*/, { success: true, data: { cookie: cookie } }];
            }
            catch (e) {
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    // 验证 Cookie
    ipcMain.handle('music-online:check-cookie', function (_event, cookie) { return __awaiter(_this, void 0, void 0, function () {
        var result, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, musicOnline.checkCookie(cookie)];
                case 1:
                    result = _a.sent();
                    if (result.valid) {
                        musicOnline.setCookie(cookie);
                    }
                    return [2 /*return*/, { success: true, data: result }];
                case 2:
                    e_5 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_5.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 扫码登录 - 获取二维码
    ipcMain.handle('music-online:qr-login-start', function () { return __awaiter(_this, void 0, void 0, function () {
        var inited, qrImage, e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, qqLogin.initLogin()];
                case 1:
                    inited = _a.sent();
                    if (!inited) {
                        return [2 /*return*/, { success: false, error: '初始化登录失败' }];
                    }
                    return [4 /*yield*/, qqLogin.getQRCode()];
                case 2:
                    qrImage = _a.sent();
                    if (!qrImage) {
                        return [2 /*return*/, { success: false, error: '获取二维码失败' }];
                    }
                    return [2 /*return*/, { success: true, data: { qrImage: qrImage } }];
                case 3:
                    e_6 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_6.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // 扫码登录 - 轮询状态
    ipcMain.handle('music-online:qr-login-poll', function () { return __awaiter(_this, void 0, void 0, function () {
        var result, e_7;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, qqLogin.checkQRStatus()];
                case 1:
                    result = _a.sent();
                    // 如果登录成功，自动设置 cookie
                    if (result.status === 'success' && result.cookie) {
                        musicOnline.setCookie(result.cookie);
                    }
                    return [2 /*return*/, { success: true, data: result }];
                case 2:
                    e_7 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_7.message }];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    // 扫码登录 - 重置/刷新二维码
    ipcMain.handle('music-online:qr-login-reset', function () { return __awaiter(_this, void 0, void 0, function () {
        var inited, qrImage, e_8;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    qqLogin.resetLogin();
                    return [4 /*yield*/, qqLogin.initLogin()];
                case 1:
                    inited = _a.sent();
                    if (!inited) {
                        return [2 /*return*/, { success: false, error: '重新初始化失败' }];
                    }
                    return [4 /*yield*/, qqLogin.getQRCode()];
                case 2:
                    qrImage = _a.sent();
                    if (!qrImage) {
                        return [2 /*return*/, { success: false, error: '重新获取二维码失败' }];
                    }
                    return [2 /*return*/, { success: true, data: { qrImage: qrImage } }];
                case 3:
                    e_8 = _a.sent();
                    return [2 /*return*/, { success: false, error: e_8.message }];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    console.log('[IPC] 音乐在线服务处理器已注册');
}
module.exports = { registerMusicOnlineHandlers: registerMusicOnlineHandlers };

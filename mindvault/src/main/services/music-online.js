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
var qqMusic = require('qq-music-api');
var currentCookie = '';
function setCookie(cookie) {
    currentCookie = cookie;
    qqMusic.setCookie(cookie);
}
function getCookie() {
    return currentCookie;
}
function searchSongs(keyword_1) {
    return __awaiter(this, arguments, void 0, function (keyword, page, limit) {
        var result, list, total, songs, e_1;
        var _a, _b, _c, _d;
        if (page === void 0) { page = 1; }
        if (limit === void 0) { limit = 30; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, qqMusic.api('search', {
                            key: keyword,
                            page: page,
                            limit: limit,
                        })];
                case 1:
                    result = _e.sent();
                    list = ((_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.song) === null || _b === void 0 ? void 0 : _b.list) || [];
                    total = ((_d = (_c = result === null || result === void 0 ? void 0 : result.data) === null || _c === void 0 ? void 0 : _c.song) === null || _d === void 0 ? void 0 : _d.totalnum) || 0;
                    songs = list.map(function (item) {
                        var _a;
                        return ({
                            id: item.songmid || item.songid,
                            songid: item.songid,
                            songmid: item.songmid,
                            name: item.songname || item.name,
                            singer: (item.singer || []).map(function (s) { return s.name; }).join(' / '),
                            album: item.albumname || '',
                            albummid: item.albummid,
                            duration: item.interval || 0, // seconds
                            strMediaMid: item.strMediaMid || '',
                            // VIP indicator
                            pay: ((_a = item.pay) === null || _a === void 0 ? void 0 : _a.pay_play) || 0,
                        });
                    });
                    return [2 /*return*/, { songs: songs, total: total }];
                case 2:
                    e_1 = _e.sent();
                    console.error('[MusicOnline] search error:', e_1.message);
                    return [2 /*return*/, { songs: [], total: 0 }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getSongUrl(songmid) {
    return __awaiter(this, void 0, void 0, function () {
        var result, url, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, qqMusic.api('song/url', {
                            id: songmid,
                        })];
                case 1:
                    result = _a.sent();
                    url = (result === null || result === void 0 ? void 0 : result.data) || (result === null || result === void 0 ? void 0 : result.url) || null;
                    return [2 /*return*/, url];
                case 2:
                    e_2 = _a.sent();
                    console.error('[MusicOnline] getSongUrl error:', e_2.message);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getLyric(songmid) {
    return __awaiter(this, void 0, void 0, function () {
        var result, lrc, tlyric, e_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, qqMusic.api('lyric', {
                            id: songmid,
                        })];
                case 1:
                    result = _c.sent();
                    lrc = ((_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.lrc) || (result === null || result === void 0 ? void 0 : result.lrc) || '';
                    tlyric = ((_b = result === null || result === void 0 ? void 0 : result.data) === null || _b === void 0 ? void 0 : _b.tlrc) || (result === null || result === void 0 ? void 0 : result.tlrc) || '';
                    return [2 /*return*/, { lrc: lrc, tlyric: tlyric }];
                case 2:
                    e_3 = _c.sent();
                    console.error('[MusicOnline] getLyric error:', e_3.message);
                    return [2 /*return*/, { lrc: '', tlyric: '' }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getSongDetail(songmids) {
    return __awaiter(this, void 0, void 0, function () {
        var result, list, e_4;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, qqMusic.api('song/detail', {
                            ids: songmids.join(','),
                        })];
                case 1:
                    result = _d.sent();
                    list = ((_b = (_a = result === null || result === void 0 ? void 0 : result.data) === null || _a === void 0 ? void 0 : _a.song) === null || _b === void 0 ? void 0 : _b.list) || ((_c = result === null || result === void 0 ? void 0 : result.data) === null || _c === void 0 ? void 0 : _c.track_info) || [];
                    return [2 /*return*/, list.map(function (item) { return ({
                            id: item.songmid || item.songid,
                            name: item.songname || item.name,
                            singer: (item.singer || []).map(function (s) { return s.name; }).join(' / '),
                            album: item.albumname || '',
                            albummid: item.albummid,
                            // Album cover URL
                            albumCover: item.albummid ? "https://y.gtimg.cn/music/photo_new/T002R300x300M000".concat(item.albummid, ".jpg") : '',
                        }); })];
                case 2:
                    e_4 = _d.sent();
                    console.error('[MusicOnline] getSongDetail error:', e_4.message);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function checkCookie(cookie) {
    return __awaiter(this, void 0, void 0, function () {
        var result, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    if (!cookie)
                        return [2 /*return*/, { valid: false }];
                    qqMusic.setCookie(cookie);
                    return [4 /*yield*/, qqMusic.api('search', { key: 'test', limit: 1 })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, { valid: true, data: result }];
                case 2:
                    e_5 = _a.sent();
                    return [2 /*return*/, { valid: false, error: e_5.message }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
module.exports = {
    setCookie: setCookie,
    getCookie: getCookie,
    searchSongs: searchSongs,
    getSongUrl: getSongUrl,
    getLyric: getLyric,
    getSongDetail: getSongDetail,
    checkCookie: checkCookie,
};

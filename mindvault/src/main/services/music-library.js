"use strict";
// @ts-nocheck
/**
 * 音乐库服务
 * 处理音乐曲目的导入、查询、搜索、收藏等操作
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
var crypto = require('crypto');
function uuidv4() {
    return crypto.randomUUID();
}
var path = require('path');
var fs = require('fs');
var repo = require('../db/repository');
// music-metadata 是 ESM 模块，需要动态导入
var _parseFile = null;
function getParseFile() {
    return __awaiter(this, void 0, void 0, function () {
        var mod;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!_parseFile) return [3 /*break*/, 2];
                    return [4 /*yield*/, import('music-metadata')];
                case 1:
                    mod = _a.sent();
                    _parseFile = mod.parseFile;
                    _a.label = 2;
                case 2: return [2 /*return*/, _parseFile];
            }
        });
    });
}
// ========== 实现 ==========
/**
 * 初始化 music_tracks 表
 * 在应用启动时调用一次
 */
function initMusicTable() {
    if (!repo.db)
        return;
    repo.db.exec("\n    CREATE TABLE IF NOT EXISTS music_tracks (\n      id TEXT PRIMARY KEY,\n      title TEXT NOT NULL DEFAULT '',\n      artist TEXT NOT NULL DEFAULT '',\n      album TEXT NOT NULL DEFAULT '',\n      src TEXT NOT NULL,\n      duration REAL NOT NULL DEFAULT 0,\n      cover_url TEXT NOT NULL DEFAULT '',\n      lrc_path TEXT NOT NULL DEFAULT '',\n      source TEXT NOT NULL DEFAULT 'local',\n      added_at INTEGER NOT NULL DEFAULT 0,\n      is_favorite INTEGER NOT NULL DEFAULT 0\n    )\n  ");
    console.log('[音乐库] music_tracks 表初始化完成');
}
/**
 * 读取音频文件元数据
 * 使用 music-metadata 解析音频文件，提取标题、艺术家、专辑、时长等信息
 */
function readMetadata(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var defaults, parseFile, metadata, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    defaults = {
                        title: path.basename(filePath, path.extname(filePath)),
                        artist: '',
                        album: '',
                        duration: 0,
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, getParseFile()];
                case 2:
                    parseFile = _a.sent();
                    return [4 /*yield*/, parseFile(filePath)];
                case 3:
                    metadata = _a.sent();
                    return [2 /*return*/, {
                            title: metadata.common.title || defaults.title,
                            artist: metadata.common.artist || '',
                            album: metadata.common.album || '',
                            duration: metadata.format.duration || 0,
                        }];
                case 4:
                    e_1 = _a.sent();
                    console.error('[音乐库] 读取元数据失败:', filePath, e_1.message);
                    return [2 /*return*/, defaults];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * 导入单个音频文件到音乐库
 * - 读取元数据
 * - 生成 UUID
 * - 检查重复（按 src 路径）
 * - 保存到数据库
 */
function importFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var existing, metadata, id, now, track, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!repo.db)
                        return [2 /*return*/, null];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    existing = repo.db
                        .prepare('SELECT id FROM music_tracks WHERE src = ?')
                        .get(filePath);
                    if (existing) {
                        console.log('[音乐库] 文件已存在，跳过:', filePath);
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, readMetadata(filePath)];
                case 2:
                    metadata = _a.sent();
                    id = uuidv4();
                    now = Date.now();
                    repo.db.prepare("\n      INSERT INTO music_tracks (id, title, artist, album, src, duration, cover_url, lrc_path, source, added_at, is_favorite)\n      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ").run(id, metadata.title, metadata.artist, metadata.album, filePath, metadata.duration, '', // cover_url
                    '', // lrc_path
                    'local', now, 0);
                    track = {
                        id: id,
                        title: metadata.title,
                        artist: metadata.artist,
                        album: metadata.album,
                        src: filePath,
                        duration: metadata.duration,
                        coverUrl: '',
                        lrcPath: '',
                        source: 'local',
                        addedAt: now,
                        isFavorite: 0,
                    };
                    console.log('[音乐库] 导入成功:', metadata.title);
                    return [2 /*return*/, track];
                case 3:
                    e_2 = _a.sent();
                    console.error('[音乐库] 导入文件失败:', filePath, e_2.message);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 批量导入音频文件
 */
function importFiles(filePaths) {
    return __awaiter(this, void 0, void 0, function () {
        var results, _i, filePaths_1, filePath, track;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    _i = 0, filePaths_1 = filePaths;
                    _a.label = 1;
                case 1:
                    if (!(_i < filePaths_1.length)) return [3 /*break*/, 4];
                    filePath = filePaths_1[_i];
                    return [4 /*yield*/, importFile(filePath)];
                case 2:
                    track = _a.sent();
                    if (track) {
                        results.push(track);
                    }
                    _a.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * 获取所有曲目，按添加时间降序排列
 */
function getAllTracks() {
    if (!repo.db)
        return [];
    var rows = repo.db.prepare('SELECT * FROM music_tracks ORDER BY added_at DESC').all();
    return repo.mapRows(rows);
}
/**
 * 根据 ID 获取单个曲目
 */
function getTrack(id) {
    if (!repo.db)
        return null;
    var row = repo.db.prepare('SELECT * FROM music_tracks WHERE id = ?').get(id);
    if (!row)
        return null;
    return repo.toCamelCase(row);
}
/**
 * 删除曲目
 * 同时尝试删除关联的封面图片文件
 */
function deleteTrack(id) {
    if (!repo.db)
        return false;
    try {
        var track = getTrack(id);
        if (!track)
            return false;
        // 尝试删除封面文件
        if (track.coverUrl) {
            try {
                if (fs.existsSync(track.coverUrl)) {
                    fs.unlinkSync(track.coverUrl);
                    console.log('[音乐库] 已删除封面文件:', track.coverUrl);
                }
            }
            catch (e) {
                console.warn('[音乐库] 删除封面文件失败:', e.message);
            }
        }
        var result = repo.db.prepare('DELETE FROM music_tracks WHERE id = ?').run(id);
        return result.changes > 0;
    }
    catch (e) {
        console.error('[音乐库] 删除曲目失败:', id, e.message);
        return false;
    }
}
/**
 * 搜索曲目（匹配标题、艺术家、专辑）
 */
function searchTracks(query) {
    if (!repo.db)
        return [];
    var pattern = "%".concat(query, "%");
    var rows = repo.db.prepare('SELECT * FROM music_tracks WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?').all(pattern, pattern, pattern);
    return repo.mapRows(rows);
}
/**
 * 切换收藏状态
 */
function toggleFavorite(id) {
    if (!repo.db)
        return false;
    try {
        var track = getTrack(id);
        if (!track)
            return false;
        var newFavorite = track.isFavorite ? 0 : 1;
        repo.db
            .prepare('UPDATE music_tracks SET is_favorite = ? WHERE id = ?')
            .run(newFavorite, id);
        return newFavorite === 1;
    }
    catch (e) {
        console.error('[音乐库] 切换收藏失败:', id, e.message);
        return false;
    }
}
/**
 * 获取收藏曲目
 */
function getFavorites() {
    if (!repo.db)
        return [];
    var rows = repo.db
        .prepare('SELECT * FROM music_tracks WHERE is_favorite = 1 ORDER BY added_at DESC')
        .all();
    return repo.mapRows(rows);
}
/**
 * 更新曲目信息
 */
function updateTrack(id, updates) {
    var _a;
    if (!repo.db)
        return false;
    try {
        var allowedFields = [
            'title', 'artist', 'album', 'coverUrl', 'lrcPath', 'isFavorite',
        ];
        var snakeMap = {
            coverUrl: 'cover_url',
            lrcPath: 'lrc_path',
            isFavorite: 'is_favorite',
        };
        var setClauses = [];
        var values = [];
        for (var _i = 0, allowedFields_1 = allowedFields; _i < allowedFields_1.length; _i++) {
            var key = allowedFields_1[_i];
            if (updates[key] !== undefined) {
                var colName = snakeMap[key] || key;
                setClauses.push("".concat(colName, " = ?"));
                values.push(updates[key]);
            }
        }
        if (setClauses.length === 0)
            return false;
        values.push(id);
        var sql = "UPDATE music_tracks SET ".concat(setClauses.join(', '), " WHERE id = ?");
        var result = (_a = repo.db.prepare(sql)).run.apply(_a, values);
        return result.changes > 0;
    }
    catch (e) {
        console.error('[音乐库] 更新曲目失败:', id, e.message);
        return false;
    }
}
module.exports = {
    initMusicTable: initMusicTable,
    readMetadata: readMetadata,
    importFile: importFile,
    importFiles: importFiles,
    getAllTracks: getAllTracks,
    getTrack: getTrack,
    deleteTrack: deleteTrack,
    searchTracks: searchTracks,
    toggleFavorite: toggleFavorite,
    getFavorites: getFavorites,
    updateTrack: updateTrack,
};

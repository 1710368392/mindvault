"use strict";
// @ts-nocheck
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
var _a = require('electron'), ipcMain = _a.ipcMain, dialog = _a.dialog, protocol = _a.protocol, net = _a.net;
var path = require('path');
var fs = require('fs');
var repo = require('../db/repository');
var _b = require('../utils/videoThumbnail'), extractThumbnail = _b.extractThumbnail, isVideoFile = _b.isVideoFile;
var thumbUtil = require('../utils/imageThumbnail');
var IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico'];
var AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma'];
var VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
var DOCUMENT_EXTS = ['.pdf'];
function getMediaType(ext) {
    if (IMAGE_EXTS.includes(ext))
        return 'image';
    if (AUDIO_EXTS.includes(ext))
        return 'audio';
    if (VIDEO_EXTS.includes(ext))
        return 'video';
    if (DOCUMENT_EXTS.includes(ext))
        return 'document';
    return null;
}
function getMimeFromExt(ext) {
    var mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
        '.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
        '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
        '.pdf': 'application/pdf',
    };
    return mimeMap[ext] || 'application/octet-stream';
}
function pathToFileUrl(filePath) {
    if (!filePath)
        return '';
    if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('local-media://')) {
        return filePath;
    }
    var normalized = filePath.replace(/\\/g, '/');
    return 'local-media:///' + encodeURI(normalized);
}
function registerMediaHandlers(mainWindow) {
    var _this = this;
    ipcMain.handle('media:list', function () {
        if (repo.db) {
            try {
                return repo.mapRows(repo.db.prepare('SELECT * FROM media ORDER BY sort_order ASC, created_at DESC').all());
            }
            catch (e) {
                return [];
            }
        }
        else {
            return repo.JsonStore.get('media') || [];
        }
    });
    ipcMain.handle('media:list-by-creativity', function (event, creativityId) {
        if (repo.db) {
            try {
                return repo.mapRows(repo.db.prepare('SELECT * FROM media WHERE creativity_id = ? ORDER BY sort_order ASC, created_at ASC').all(creativityId));
            }
            catch (e) {
                return [];
            }
        }
        else {
            return (repo.JsonStore.get('media') || []).filter(function (m) { return m.creativityId === creativityId; });
        }
    });
    ipcMain.handle('media:save', function (event, data, creativityId) { return __awaiter(_this, void 0, void 0, function () {
        var uint8, ext, mediaType, mimeType, prefix, filename, filePath, mediaRecord_1, thumbPath, matches, mimeType, base64Data, mimeToExt, ext, mediaType, prefix, filename, filePath, mediaRecord_2, thumbPath;
        var _a, _b;
        return __generator(this, function (_c) {
            try {
                console.log('[IPC] media:save 收到请求, fileName:', data === null || data === void 0 ? void 0 : data.fileName, 'fileType:', data === null || data === void 0 ? void 0 : data.fileType, 'dataSize:', ((_a = data === null || data === void 0 ? void 0 : data.data) === null || _a === void 0 ? void 0 : _a.length) || ((_b = data === null || data === void 0 ? void 0 : data.data) === null || _b === void 0 ? void 0 : _b.byteLength) || 'N/A');
                if (data && data.data && data.fileName) {
                    uint8 = void 0;
                    if (data.data instanceof Uint8Array) {
                        uint8 = data.data;
                    }
                    else if (data.data instanceof ArrayBuffer) {
                        uint8 = new Uint8Array(data.data);
                    }
                    else if (ArrayBuffer.isView(data.data)) {
                        uint8 = new Uint8Array(data.data.buffer, data.data.byteOffset, data.data.byteLength);
                    }
                    else if (Array.isArray(data.data)) {
                        uint8 = new Uint8Array(data.data);
                    }
                    else if (data.data && typeof data.data === 'object' && data.data.type === 'Buffer' && Array.isArray(data.data.data)) {
                        uint8 = new Uint8Array(data.data.data);
                    }
                    else if (data.data && typeof data.data === 'object' && data.data.length !== undefined) {
                        try {
                            uint8 = new Uint8Array(Array.from(data.data));
                        }
                        catch (e) {
                            console.error('[IPC] media:save 无法识别的数据格式:', typeof data.data, e);
                            return [2 /*return*/, { success: false, error: '无法识别的数据格式' }];
                        }
                    }
                    else {
                        console.error('[IPC] media:save 无法识别的数据格式:', typeof data.data);
                        return [2 /*return*/, { success: false, error: '无法识别的数据格式' }];
                    }
                    console.log('[IPC] media:save uint8 length:', uint8.length, 'mediaDir:', repo.mediaDir);
                    ext = path.extname(data.fileName).toLowerCase();
                    mediaType = data.fileType || getMediaType(ext) || 'image';
                    mimeType = getMimeFromExt(ext);
                    prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
                    filename = "".concat(prefix, "_").concat(Date.now()).concat(ext);
                    filePath = path.join(repo.mediaDir, filename);
                    fs.writeFileSync(filePath, Buffer.from(uint8));
                    console.log('[IPC] media:save 文件已写入:', filePath, '大小:', fs.statSync(filePath).size);
                    mediaRecord_1 = {
                        id: repo.generateId(),
                        creativityId: data.creativityId || null,
                        type: mediaType,
                        filename: filename,
                        originalName: data.fileName,
                        filePath: filePath,
                        mimeType: mimeType,
                        fileSize: fs.statSync(filePath).size,
                        width: data.width || null,
                        height: data.height || null,
                        sortOrder: data.sortOrder || 0,
                        createdAt: new Date().toISOString(),
                    };
                    if (repo.db) {
                        repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                            .run(mediaRecord_1.id, mediaRecord_1.creativityId, mediaRecord_1.filename, mediaRecord_1.filePath, mediaRecord_1.mimeType, mediaRecord_1.fileSize, mediaRecord_1.width, mediaRecord_1.height, null, mediaRecord_1.sortOrder, mediaRecord_1.createdAt);
                    }
                    else {
                        repo.JsonStore.get('media').push(mediaRecord_1);
                        repo.JsonStore.save();
                    }
                    if (mediaType === 'image') {
                        thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
                        thumbUtil.generateImageThumbnail(filePath, thumbPath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_1.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成缩略图失败:', e);
                        });
                    }
                    if (mediaType === 'video') {
                        extractThumbnail(filePath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_1.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新视频缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成视频缩略图失败:', e);
                        });
                    }
                    return [2 /*return*/, { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord_1) : mediaRecord_1 }];
                }
                if (typeof data === 'string' && data.startsWith('data:')) {
                    matches = data.match(/^data:([\w/+]+);base64,(.+)$/);
                    if (!matches)
                        return [2 /*return*/, { success: false, error: '无法解析数据格式' }];
                    mimeType = matches[1];
                    base64Data = matches[2];
                    mimeToExt = {
                        'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
                        'image/bmp': '.bmp', 'image/webp': '.webp', 'image/svg+xml': '.svg',
                        'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/ogg': '.ogg',
                        'audio/flac': '.flac', 'audio/aac': '.aac',
                        'video/mp4': '.mp4', 'video/webm': '.webm',
                    };
                    ext = mimeToExt[mimeType] || '.bin';
                    mediaType = mimeType.startsWith('image/') ? 'image' : mimeType.startsWith('audio/') ? 'audio' : mimeType.startsWith('video/') ? 'video' : 'image';
                    prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : 'img';
                    filename = "".concat(prefix, "_").concat(Date.now()).concat(ext);
                    filePath = path.join(repo.mediaDir, filename);
                    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
                    mediaRecord_2 = {
                        id: repo.generateId(),
                        creativityId: creativityId || null,
                        type: mediaType,
                        filename: filename,
                        originalName: filename,
                        filePath: filePath,
                        mimeType: mimeType,
                        fileSize: fs.statSync(filePath).size,
                        sortOrder: 0,
                        createdAt: new Date().toISOString(),
                    };
                    if (repo.db) {
                        repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                            .run(mediaRecord_2.id, mediaRecord_2.creativityId, mediaRecord_2.filename, mediaRecord_2.filePath, mediaRecord_2.mimeType, mediaRecord_2.fileSize, null, null, null, mediaRecord_2.sortOrder, mediaRecord_2.createdAt);
                    }
                    else {
                        repo.JsonStore.get('media').push(mediaRecord_2);
                        repo.JsonStore.save();
                    }
                    if (mediaType === 'image') {
                        thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
                        thumbUtil.generateImageThumbnail(filePath, thumbPath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_2.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成缩略图失败:', e);
                        });
                    }
                    if (mediaType === 'video') {
                        extractThumbnail(filePath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_2.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新视频缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成视频缩略图失败:', e);
                        });
                    }
                    return [2 /*return*/, { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord_2) : mediaRecord_2 }];
                }
                return [2 /*return*/, { success: false, error: '不支持的数据格式' }];
            }
            catch (e) {
                console.error('[IPC] 保存媒体失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    ipcMain.handle('media:save-image', function (event, imageDataUrl, creativityId) { return __awaiter(_this, void 0, void 0, function () {
        var matches, ext, base64Data, filename, filePath, mediaRecord_3, thumbPath;
        return __generator(this, function (_a) {
            if (!imageDataUrl.startsWith('data:image')) {
                return [2 /*return*/, { success: false, error: '无效的图片数据' }];
            }
            try {
                matches = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
                if (!matches)
                    return [2 /*return*/, { success: false, error: '无法解析图片格式' }];
                ext = matches[1];
                base64Data = Buffer.from(matches[2], 'base64');
                filename = "img_".concat(Date.now(), ".").concat(ext);
                filePath = path.join(repo.mediaDir, filename);
                fs.writeFileSync(filePath, base64Data);
                mediaRecord_3 = {
                    id: repo.generateId(),
                    creativityId: creativityId || null,
                    type: 'image',
                    filename: filename,
                    originalName: filename,
                    filePath: filePath,
                    mimeType: "image/".concat(ext),
                    fileSize: fs.statSync(filePath).size,
                    sortOrder: 0,
                    createdAt: new Date().toISOString(),
                };
                if (repo.db) {
                    repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                        .run(mediaRecord_3.id, mediaRecord_3.creativityId, mediaRecord_3.filename, mediaRecord_3.filePath, mediaRecord_3.mimeType, mediaRecord_3.fileSize, null, null, null, mediaRecord_3.sortOrder, mediaRecord_3.createdAt);
                }
                else {
                    repo.JsonStore.get('media').push(mediaRecord_3);
                    repo.JsonStore.save();
                }
                thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
                thumbUtil.generateImageThumbnail(filePath, thumbPath).then(function (tp) {
                    if (tp && repo.db) {
                        try {
                            repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_3.id);
                        }
                        catch (e) {
                            console.error('[IPC] 更新缩略图路径失败:', e);
                        }
                    }
                }).catch(function (e) {
                    console.error('[IPC] 生成缩略图失败:', e);
                });
                return [2 /*return*/, { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord_3) : mediaRecord_3 }];
            }
            catch (e) {
                console.error('[IPC] 保存图片失败:', e);
                return [2 /*return*/, { success: false, error: e.message }];
            }
            return [2 /*return*/];
        });
    }); });
    ipcMain.handle('media:read', function (event, idOrPath) {
        try {
            var filePath = idOrPath;
            if (repo.db && idOrPath && !idOrPath.includes(path.sep) && !idOrPath.startsWith('data:') && !idOrPath.startsWith('http')) {
                var record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(idOrPath);
                if (record) {
                    filePath = record.file_path || record.filePath;
                }
            }
            if (!filePath || filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
                return filePath || null;
            }
            if (!fs.existsSync(filePath))
                return null;
            return pathToFileUrl(filePath);
        }
        catch (e) {
            console.error('[IPC] 读取媒体失败:', e);
            return null;
        }
    });
    ipcMain.handle('media:read-file', function (event, filePath) {
        try {
            if (fs.existsSync(filePath)) {
                var ext = path.extname(filePath).toLowerCase();
                if (IMAGE_EXTS.includes(ext)) {
                    var buffer = fs.readFileSync(filePath);
                    return "data:image/".concat(ext.replace('.', ''), ";base64,").concat(buffer.toString('base64'));
                }
                return pathToFileUrl(filePath);
            }
            return null;
        }
        catch (e) {
            console.error('[IPC] 读取文件失败:', e);
            return null;
        }
    });
    ipcMain.handle('media:delete', function (event, mediaId) {
        if (repo.db) {
            try {
                var record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(mediaId);
                if (record && record.file_path && fs.existsSync(record.file_path)) {
                    fs.unlinkSync(record.file_path);
                }
                if (record && record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
                    fs.unlinkSync(record.thumbnail_path);
                }
                repo.db.prepare('DELETE FROM media WHERE id = ?').run(mediaId);
                return { success: true };
            }
            catch (e) {
                return { success: false, error: e.message };
            }
        }
        else {
            var mediaList = repo.JsonStore.get('media');
            var idx = mediaList.findIndex(function (m) { return m.id === mediaId; });
            if (idx >= 0) {
                var record = mediaList[idx];
                if (record.filePath && fs.existsSync(record.filePath)) {
                    fs.unlinkSync(record.filePath);
                }
                if (record.thumbnailPath && fs.existsSync(record.thumbnailPath)) {
                    fs.unlinkSync(record.thumbnailPath);
                }
                mediaList.splice(idx, 1);
                repo.JsonStore.save();
                return { success: true };
            }
            return { success: false, error: '未找到媒体记录' };
        }
    });
    ipcMain.handle('media:select-file', function (event_1) {
        var args_1 = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args_1[_i - 1] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([event_1], args_1, true), void 0, function (event, options) {
            var result, creativityId, savedFiles, _loop_1, fi, e_1;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        console.log('[IPC] media:select-file 被调用, options:', JSON.stringify(options));
                        return [4 /*yield*/, dialog.showOpenDialog(mainWindow, {
                                properties: ['openFile', 'multiSelections'],
                                filters: [
                                    { name: '所有文件', extensions: ['*'] },
                                    { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
                                    { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] },
                                    { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
                                    { name: '文档文件', extensions: ['pdf'] },
                                ],
                            })];
                    case 1:
                        result = _a.sent();
                        if (result.canceled || result.filePaths.length === 0) {
                            return [2 /*return*/, { success: false, canceled: true }];
                        }
                        creativityId = options.creativityId || null;
                        savedFiles = [];
                        _loop_1 = function (fi) {
                            var selectedPath = result.filePaths[fi];
                            var ext = path.extname(selectedPath).toLowerCase();
                            var mediaType = getMediaType(ext);
                            if (!mediaType)
                                return "continue";
                            var mimeType = getMimeFromExt(ext);
                            var prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
                            var filename = "".concat(prefix, "_").concat(Date.now(), "_").concat(fi).concat(ext);
                            var destPath = path.join(repo.mediaDir, filename);
                            fs.copyFileSync(selectedPath, destPath);
                            var mediaRecord = {
                                id: repo.generateId(),
                                creativityId: creativityId,
                                type: mediaType,
                                filename: filename,
                                originalName: path.basename(selectedPath),
                                filePath: destPath,
                                mimeType: mimeType,
                                fileSize: fs.statSync(destPath).size,
                                sortOrder: fi,
                                createdAt: new Date().toISOString(),
                            };
                            if (repo.db) {
                                repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                                    .run(mediaRecord.id, mediaRecord.creativityId, mediaRecord.filename, mediaRecord.filePath, mediaRecord.mimeType, mediaRecord.fileSize, null, null, null, mediaRecord.sortOrder, mediaRecord.createdAt);
                            }
                            else {
                                repo.JsonStore.get('media').push(mediaRecord);
                                repo.JsonStore.save();
                            }
                            if (mediaType === 'image') {
                                var thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
                                thumbUtil.generateImageThumbnail(destPath, thumbPath).then(function (tp) {
                                    if (tp && repo.db) {
                                        try {
                                            repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
                                        }
                                        catch (e) {
                                            console.error('[IPC] 更新缩略图路径失败:', e);
                                        }
                                    }
                                }).catch(function (e) {
                                    console.error('[IPC] 生成缩略图失败:', e);
                                });
                            }
                            if (mediaType === 'video') {
                                extractThumbnail(destPath).then(function (tp) {
                                    if (tp && repo.db) {
                                        try {
                                            repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord.id);
                                        }
                                        catch (e) {
                                            console.error('[IPC] 更新视频缩略图路径失败:', e);
                                        }
                                    }
                                }).catch(function (e) {
                                    console.error('[IPC] 生成视频缩略图失败:', e);
                                });
                            }
                            savedFiles.push(repo.toCamelCase ? repo.toCamelCase(mediaRecord) : mediaRecord);
                        };
                        for (fi = 0; fi < result.filePaths.length; fi++) {
                            _loop_1(fi);
                        }
                        if (savedFiles.length === 0) {
                            return [2 /*return*/, { success: false, error: '不支持的文件类型' }];
                        }
                        return [2 /*return*/, { success: true, data: savedFiles }];
                    case 2:
                        e_1 = _a.sent();
                        console.error('[IPC] 选择文件失败:', e_1);
                        return [2 /*return*/, { success: false, error: e_1.message }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    });
    ipcMain.handle('media:import-from-path', function (event_1, filePath_1) {
        var args_1 = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args_1[_i - 2] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([event_1, filePath_1], args_1, true), void 0, function (event, filePath, options) {
            var ext, mediaType, mimeType, prefix, filename, destPath, creativityId, mediaRecord_4, thumbPath;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_a) {
                try {
                    if (!filePath || !fs.existsSync(filePath)) {
                        return [2 /*return*/, { success: false, error: '文件不存在: ' + filePath }];
                    }
                    ext = path.extname(filePath).toLowerCase();
                    mediaType = options.fileType || getMediaType(ext);
                    if (!mediaType) {
                        return [2 /*return*/, { success: false, error: '不支持的文件类型: ' + ext }];
                    }
                    mimeType = getMimeFromExt(ext);
                    prefix = mediaType === 'video' ? 'vid' : mediaType === 'audio' ? 'aud' : mediaType === 'document' ? 'doc' : 'img';
                    filename = "".concat(prefix, "_").concat(Date.now()).concat(ext);
                    destPath = path.join(repo.mediaDir, filename);
                    fs.copyFileSync(filePath, destPath);
                    creativityId = options.creativityId || null;
                    mediaRecord_4 = {
                        id: repo.generateId(),
                        creativityId: creativityId,
                        type: mediaType,
                        filename: filename,
                        originalName: options.fileName || path.basename(filePath),
                        filePath: destPath,
                        mimeType: mimeType,
                        fileSize: fs.statSync(destPath).size,
                        sortOrder: options.sortOrder || 0,
                        createdAt: new Date().toISOString(),
                    };
                    if (repo.db) {
                        repo.db.prepare('INSERT INTO media (id, creativity_id, filename, filepath, mime_type, file_size, width, height, thumbnail_path, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                            .run(mediaRecord_4.id, mediaRecord_4.creativityId, mediaRecord_4.filename, mediaRecord_4.filePath, mediaRecord_4.mimeType, mediaRecord_4.fileSize, null, null, null, mediaRecord_4.sortOrder, mediaRecord_4.createdAt);
                    }
                    else {
                        repo.JsonStore.get('media').push(mediaRecord_4);
                        repo.JsonStore.save();
                    }
                    if (mediaType === 'image') {
                        thumbPath = thumbUtil.getThumbnailPath(repo.mediaDir, filename);
                        thumbUtil.generateImageThumbnail(destPath, thumbPath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_4.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成缩略图失败:', e);
                        });
                    }
                    if (mediaType === 'video') {
                        extractThumbnail(destPath).then(function (tp) {
                            if (tp && repo.db) {
                                try {
                                    repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(tp, mediaRecord_4.id);
                                }
                                catch (e) {
                                    console.error('[IPC] 更新视频缩略图路径失败:', e);
                                }
                            }
                        }).catch(function (e) {
                            console.error('[IPC] 生成视频缩略图失败:', e);
                        });
                    }
                    return [2 /*return*/, { success: true, data: repo.toCamelCase ? repo.toCamelCase(mediaRecord_4) : mediaRecord_4 }];
                }
                catch (e) {
                    console.error('[IPC] 从路径导入文件失败:', e);
                    return [2 /*return*/, { success: false, error: e.message }];
                }
                return [2 /*return*/];
            });
        });
    });
    ipcMain.handle('media:thumbnail', function (event, idOrPath, width, height) {
        try {
            var filePath = idOrPath;
            if (repo.db && idOrPath && !idOrPath.includes(path.sep) && !idOrPath.startsWith('data:') && !idOrPath.startsWith('http') && !idOrPath.startsWith('file://')) {
                var record = repo.db.prepare('SELECT * FROM media WHERE id = ?').get(idOrPath);
                if (record) {
                    filePath = record.file_path || record.filePath;
                }
            }
            if (!filePath || !fs.existsSync(filePath))
                return null;
            var ext = path.extname(filePath).toLowerCase();
            if (IMAGE_EXTS.includes(ext)) {
                var buffer = fs.readFileSync(filePath);
                return "data:image/".concat(ext.replace('.', ''), ";base64,").concat(buffer.toString('base64'));
            }
            return pathToFileUrl(filePath);
        }
        catch (e) {
            console.error('[IPC] 获取缩略图失败:', e);
            return null;
        }
    });
    ipcMain.handle('media:get-thumbnail', function (event, filePath, width, height) {
        try {
            if (!fs.existsSync(filePath))
                return null;
            var ext = path.extname(filePath).toLowerCase();
            if (IMAGE_EXTS.includes(ext)) {
                var buffer = fs.readFileSync(filePath);
                return "data:image/".concat(ext.replace('.', ''), ";base64,").concat(buffer.toString('base64'));
            }
            return pathToFileUrl(filePath);
        }
        catch (e) {
            console.error('[IPC] 获取缩略图失败:', e);
            return null;
        }
    });
    ipcMain.handle('media:get-url', function (event, filePath) {
        if (!filePath)
            return null;
        if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('file://')) {
            return filePath;
        }
        try {
            if (fs.existsSync(filePath)) {
                return pathToFileUrl(filePath);
            }
        }
        catch (e) { }
        return pathToFileUrl(filePath);
    });
    ipcMain.handle('file:select', function (event, filters) { return __awaiter(_this, void 0, void 0, function () {
        var dialogFilters, result, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    dialogFilters = filters || [
                        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'] },
                        { name: '视频文件', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] },
                        { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
                        { name: '文档文件', extensions: ['pdf'] },
                        { name: '所有文件', extensions: ['*'] },
                    ];
                    return [4 /*yield*/, dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: dialogFilters,
                        })];
                case 1:
                    result = _a.sent();
                    if (result.canceled || result.filePaths.length === 0) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, result.filePaths[0]];
                case 2:
                    e_2 = _a.sent();
                    console.error('[IPC] 文件选择失败:', e_2);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('file:save', function (event, defaultPath, filters) { return __awaiter(_this, void 0, void 0, function () {
        var result, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, dialog.showSaveDialog(mainWindow, {
                            defaultPath: defaultPath,
                            filters: filters || [{ name: '所有文件', extensions: ['*'] }],
                        })];
                case 1:
                    result = _a.sent();
                    if (result.canceled)
                        return [2 /*return*/, null];
                    return [2 /*return*/, result.filePath];
                case 2:
                    e_3 = _a.sent();
                    console.error('[IPC] 文件保存失败:', e_3);
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('file:select-multiple', function (event, filters) { return __awaiter(_this, void 0, void 0, function () {
        var dialogFilters, result, e_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    dialogFilters = filters || [
                        { name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2', 'ttc'] },
                        { name: '所有文件', extensions: ['*'] },
                    ];
                    return [4 /*yield*/, dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile', 'multiSelections'],
                            filters: dialogFilters,
                        })];
                case 1:
                    result = _a.sent();
                    if (result.canceled || result.filePaths.length === 0) {
                        return [2 /*return*/, []];
                    }
                    return [2 /*return*/, result.filePaths];
                case 2:
                    e_4 = _a.sent();
                    console.error('[IPC] 多文件选择失败:', e_4);
                    return [2 /*return*/, []];
                case 3: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('file:read-text', function (event, filePath) { return __awaiter(_this, void 0, void 0, function () {
        var content;
        return __generator(this, function (_a) {
            try {
                if (!filePath || !fs.existsSync(filePath))
                    return [2 /*return*/, null];
                content = fs.readFileSync(filePath, 'utf-8');
                return [2 /*return*/, content.substring(0, 5000)];
            }
            catch (e) {
                console.error('[IPC] 读取文本文件失败:', e);
                return [2 /*return*/, null];
            }
            return [2 /*return*/];
        });
    }); });
    ipcMain.handle('media:link-to-creativity', function (event, mediaIds, creativityId) {
        try {
            if (!Array.isArray(mediaIds) || !creativityId)
                return { success: false, error: '参数无效' };
            if (repo.db) {
                var stmt = repo.db.prepare('UPDATE media SET creativity_id = ? WHERE id = ?');
                for (var _i = 0, mediaIds_1 = mediaIds; _i < mediaIds_1.length; _i++) {
                    var mediaId = mediaIds_1[_i];
                    stmt.run(creativityId, mediaId);
                }
            }
            else {
                var mediaList = repo.JsonStore.get('media');
                var _loop_2 = function (mediaId) {
                    var item = mediaList.find(function (m) { return m.id === mediaId; });
                    if (item)
                        item.creativityId = creativityId;
                };
                for (var _a = 0, mediaIds_2 = mediaIds; _a < mediaIds_2.length; _a++) {
                    var mediaId = mediaIds_2[_a];
                    _loop_2(mediaId);
                }
                repo.JsonStore.save();
            }
            return { success: true, updatedCount: mediaIds.length };
        }
        catch (e) {
            console.error('[IPC] 关联媒体失败:', e);
            return { success: false, error: e.message };
        }
    });
    ipcMain.handle('media:get-file-size', function (event, filePath) {
        try {
            if (!filePath || !fs.existsSync(filePath))
                return 0;
            var stat = fs.statSync(filePath);
            return stat.size;
        }
        catch (e) {
            return 0;
        }
    });
    ipcMain.handle('media:get-thumbnail-url', function (event, idOrPath) { return __awaiter(_this, void 0, void 0, function () {
        var lookupValue, record, videoPath, thumbPath, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!idOrPath)
                        return [2 /*return*/, null];
                    lookupValue = idOrPath;
                    if (idOrPath.startsWith('media://')) {
                        lookupValue = idOrPath.slice(8);
                    }
                    if (!repo.db) return [3 /*break*/, 2];
                    record = null;
                    if (!lookupValue.includes(path.sep) && !lookupValue.startsWith('data:') && !lookupValue.startsWith('http') && !lookupValue.startsWith('file://')) {
                        record = repo.db.prepare('SELECT id, thumbnail_path, filepath FROM media WHERE id = ?').get(lookupValue);
                    }
                    else {
                        record = repo.db.prepare('SELECT id, thumbnail_path, filepath FROM media WHERE filepath = ?').get(lookupValue);
                    }
                    if (record && record.thumbnail_path && fs.existsSync(record.thumbnail_path)) {
                        return [2 /*return*/, pathToFileUrl(record.thumbnail_path)];
                    }
                    videoPath = record ? record.filepath : (lookupValue.includes(path.sep) ? lookupValue : null);
                    if (!(videoPath && fs.existsSync(videoPath) && isVideoFile(videoPath))) return [3 /*break*/, 2];
                    return [4 /*yield*/, extractThumbnail(videoPath)];
                case 1:
                    thumbPath = _a.sent();
                    if (thumbPath) {
                        if (record) {
                            try {
                                repo.db.prepare('UPDATE media SET thumbnail_path = ? WHERE id = ?').run(thumbPath, record.id);
                            }
                            catch (e) {
                                console.error('[IPC] 更新视频缩略图路径失败:', e);
                            }
                        }
                        return [2 /*return*/, pathToFileUrl(thumbPath)];
                    }
                    _a.label = 2;
                case 2: return [2 /*return*/, null];
                case 3:
                    e_5 = _a.sent();
                    console.error('[IPC] 获取缩略图URL失败:', e_5);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    ipcMain.handle('media:migrate-content-references', function () {
        if (!repo.db)
            return { migrated: 0, skipped: 0 };
        try {
            var mediaRows = repo.mapRows(repo.db.prepare('SELECT id, filepath FROM media').all());
            var pathToId = new Map();
            for (var _i = 0, mediaRows_1 = mediaRows; _i < mediaRows_1.length; _i++) {
                var row = mediaRows_1[_i];
                if (row.filepath) {
                    pathToId.set(row.filepath, row.id);
                }
            }
            var creativities = repo.mapRows(repo.db.prepare("SELECT id, content, type FROM creativities WHERE type IN ('image', 'audio', 'video') AND status = 'active'").all());
            var migrated = 0;
            var skipped = 0;
            var updateStmt = repo.db.prepare('UPDATE creativities SET content = ? WHERE id = ?');
            for (var _a = 0, creativities_1 = creativities; _a < creativities_1.length; _a++) {
                var c = creativities_1[_a];
                if (!c.content) {
                    skipped++;
                    continue;
                }
                if (c.content.startsWith('media://')) {
                    skipped++;
                    continue;
                }
                if (c.content.startsWith('data:') || c.content.startsWith('http://') || c.content.startsWith('https://')) {
                    skipped++;
                    continue;
                }
                var isFilePath = /^[A-Za-z]:\\/.test(c.content) || c.content.startsWith('/') || c.content.startsWith('.\\') || c.content.startsWith('./');
                if (!isFilePath) {
                    skipped++;
                    continue;
                }
                var mediaId = pathToId.get(c.content);
                if (mediaId) {
                    updateStmt.run('media://' + mediaId, c.id);
                    migrated++;
                }
                else {
                    var likeRecords = repo.mapRows(repo.db.prepare('SELECT id FROM media WHERE creativity_id = ? LIMIT 1').all(c.id));
                    if (likeRecords.length > 0) {
                        updateStmt.run('media://' + likeRecords[0].id, c.id);
                        migrated++;
                    }
                    else {
                        skipped++;
                    }
                }
            }
            console.log('[IPC] content引用迁移完成: migrated=' + migrated + ', skipped=' + skipped);
            return { migrated: migrated, skipped: skipped };
        }
        catch (e) {
            console.error('[IPC] content引用迁移失败:', e);
            return { migrated: 0, skipped: 0, error: e.message };
        }
    });
    ipcMain.handle('media:load-all-paths', function () {
        if (!repo.db)
            return [];
        try {
            return repo.mapRows(repo.db.prepare('SELECT id, filepath FROM media').all());
        }
        catch (e) {
            console.error('[IPC] 加载媒体路径失败:', e);
            return [];
        }
    });

    // 获取文件信息（用于批量导入时获取文件大小和缩略图）
    ipcMain.handle('media:get-file-info', async function (event, filePath) {
        try {
            if (!filePath || !fs.existsSync(filePath)) {
                return null;
            }
            var stat = fs.statSync(filePath);
            var ext = path.extname(filePath).toLowerCase();
            var fileName = path.basename(filePath);

            // 判断文件类型
            var fileType = 'application/octet-stream';
            if (IMAGE_EXTS.includes(ext)) fileType = 'image/' + ext.replace('.', '');
            else if (VIDEO_EXTS.includes(ext)) fileType = 'video/' + ext.replace('.', '');
            else if (AUDIO_EXTS.includes(ext)) fileType = 'audio/' + ext.replace('.', '');
            else if (ext === '.pdf') fileType = 'application/pdf';
            else if (ext === '.txt' || ext === '.md') fileType = 'text/plain';

            // 生成缩略图（图片直接返回 base64）
            var thumbnailUrl = null;
            if (IMAGE_EXTS.includes(ext)) {
                try {
                    var buffer = fs.readFileSync(filePath);
                    thumbnailUrl = 'data:image/' + ext.replace('.', '') + ';base64,' + buffer.toString('base64');
                } catch (e) {
                    console.error('[IPC] 生成图片缩略图失败:', e);
                }
            }

            return {
                filePath: filePath,
                fileName: fileName,
                fileSize: stat.size,
                fileType: fileType,
                thumbnailUrl: thumbnailUrl,
            };
        } catch (e) {
            console.error('[IPC] 获取文件信息失败:', e);
            return null;
        }
    });

    console.log('[IPC] 媒体处理器已注册');
}
module.exports = { registerMediaHandlers: registerMediaHandlers };

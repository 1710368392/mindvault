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
var execFile = require('child_process').execFile;
var path = require('path');
var fs = require('fs');
var repo = require('../db/repository');
var ffmpegPath = null;
var ffmpegChecked = false;
var VIDEO_EXTS = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv', '.flv'];
function isVideoFile(filePath) {
    var ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTS.includes(ext);
}
function checkFfmpeg() {
    return new Promise(function (resolve) {
        if (ffmpegChecked) {
            resolve(ffmpegPath);
            return;
        }
        ffmpegChecked = true;
        try {
            var staticPath = require('ffmpeg-static');
            if (staticPath && fs.existsSync(staticPath)) {
                ffmpegPath = staticPath;
                console.log('[videoThumbnail] 使用内置 ffmpeg:', ffmpegPath);
                resolve(ffmpegPath);
                return;
            }
        }
        catch (e) {
            console.log('[videoThumbnail] ffmpeg-static 不可用:', e.message);
        }
        var cmd = process.platform === 'win32' ? 'where' : 'which';
        execFile(cmd, ['ffmpeg'], function (err) {
            if (!err) {
                ffmpegPath = 'ffmpeg';
                console.log('[videoThumbnail] 使用系统 PATH 中的 ffmpeg');
            }
            else {
                ffmpegPath = null;
                console.log('[videoThumbnail] ffmpeg 不可用，跳过缩略图生成');
            }
            resolve(ffmpegPath);
        });
    });
}
function getThumbnailsDir() {
    var dir = path.join(repo.mediaDir, 'thumbnails');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function extractThumbnail(videoPath) {
    var _this = this;
    return new Promise(function (resolve) { return __awaiter(_this, void 0, void 0, function () {
        var ffmpeg, thumbDir, videoBasename, thumbFilename, thumbPath, args;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!isVideoFile(videoPath)) {
                        resolve(null);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, checkFfmpeg()];
                case 1:
                    ffmpeg = _a.sent();
                    if (!ffmpeg) {
                        resolve(null);
                        return [2 /*return*/];
                    }
                    if (!fs.existsSync(videoPath)) {
                        console.log('[videoThumbnail] 视频文件不存在:', videoPath);
                        resolve(null);
                        return [2 /*return*/];
                    }
                    thumbDir = getThumbnailsDir();
                    videoBasename = path.basename(videoPath, path.extname(videoPath));
                    thumbFilename = "thumb_".concat(videoBasename, ".jpg");
                    thumbPath = path.join(thumbDir, thumbFilename);
                    if (fs.existsSync(thumbPath)) {
                        resolve(thumbPath);
                        return [2 /*return*/];
                    }
                    args = [
                        '-i', videoPath,
                        '-ss', '00:00:01',
                        '-frames:v', '1',
                        '-q:v', '2',
                        '-vf', 'scale=300:-1',
                        '-y',
                        thumbPath,
                    ];
                    execFile(ffmpeg, args, { timeout: 15000 }, function (err, stdout, stderr) {
                        if (err) {
                            console.error('[videoThumbnail] ffmpeg 提取缩略图失败:', err.message);
                            resolve(null);
                            return;
                        }
                        if (!fs.existsSync(thumbPath) || fs.statSync(thumbPath).size === 0) {
                            console.error('[videoThumbnail] 缩略图文件未生成或为空');
                            resolve(null);
                            return;
                        }
                        console.log('[videoThumbnail] 缩略图已生成:', thumbPath);
                        resolve(thumbPath);
                    });
                    return [2 /*return*/];
            }
        });
    }); });
}
module.exports = { extractThumbnail: extractThumbnail, isVideoFile: isVideoFile, checkFfmpeg: checkFfmpeg };

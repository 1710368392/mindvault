/**
 * 备份服务
 * 负责数据库备份的创建、恢复和自动备份管理
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
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { getBackupDir, getDatabasePath, getMediaDir } from '../db/migration';
import { formatTime, ensureDir } from '../utils';
var BackupService = /** @class */ (function () {
    function BackupService(userDataPath) {
        this.userDataPath = userDataPath;
        this.autoBackupTimer = null;
        this.backupDir = getBackupDir(userDataPath);
    }
    /**
     * 创建数据库备份
     * 将数据库文件和媒体目录打包为zip备份
     * @returns 备份文件路径
     */
    BackupService.prototype.createBackup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, backupFileName, backupPath, dbPath, mediaDir, mediaCount, mediaTotalSize, metadata;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ensureDir(this.backupDir);
                        timestamp = formatTime()
                            .replace(/[:.]/g, '-')
                            .replace('T', '_')
                            .substring(0, 19);
                        backupFileName = "mindvault_backup_".concat(timestamp, ".zip");
                        backupPath = path.join(this.backupDir, backupFileName);
                        dbPath = getDatabasePath(this.userDataPath);
                        mediaDir = getMediaDir(this.userDataPath);
                        mediaCount = this.countMediaFiles(mediaDir);
                        mediaTotalSize = this.getMediaTotalSize(mediaDir);
                        metadata = {
                            version: '1.0.0',
                            created_at: formatTime(),
                            db_size: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
                            media_count: mediaCount,
                            media_total_size: mediaTotalSize,
                        };
                        // 使用archiver创建zip备份
                        return [4 /*yield*/, new Promise(function (resolve, reject) {
                                var output = fs.createWriteStream(backupPath);
                                var archive = archiver('zip', { zlib: { level: 9 } });
                                output.on('close', function () {
                                    console.log("[\u5907\u4EFD] ZIP\u5907\u4EFD\u5DF2\u521B\u5EFA: ".concat(backupPath, " (").concat(archive.pointer(), " \u5B57\u8282)"));
                                    resolve();
                                });
                                archive.on('error', function (err) {
                                    reject(err);
                                });
                                archive.pipe(output);
                                // 添加数据库文件到zip
                                if (fs.existsSync(dbPath)) {
                                    archive.file(dbPath, { name: 'mindvault.db' });
                                }
                                // 添加媒体目录到zip（递归）
                                if (fs.existsSync(mediaDir)) {
                                    archive.directory(mediaDir, 'media');
                                }
                                // 添加元数据JSON到zip
                                archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
                                archive.finalize();
                            })];
                    case 1:
                        // 使用archiver创建zip备份
                        _a.sent();
                        // 清理过期备份
                        this.cleanOldBackups();
                        return [2 /*return*/, backupPath];
                }
            });
        });
    };
    /**
     * 从备份恢复数据库
     * @param backupPath - 备份zip文件路径
     */
    BackupService.prototype.restoreBackup = function (backupPath) {
        return __awaiter(this, void 0, void 0, function () {
            var dbPath, mediaDir, preRestoreTimestamp, preRestoreBackup;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!fs.existsSync(backupPath)) {
                            throw new Error('备份文件不存在');
                        }
                        dbPath = getDatabasePath(this.userDataPath);
                        mediaDir = getMediaDir(this.userDataPath);
                        if (!fs.existsSync(dbPath)) return [3 /*break*/, 2];
                        preRestoreTimestamp = formatTime().replace(/[:.]/g, '-').substring(0, 19);
                        preRestoreBackup = path.join(this.backupDir, "pre_restore_".concat(preRestoreTimestamp, ".zip"));
                        return [4 /*yield*/, this.createQuickBackup(preRestoreBackup, dbPath, mediaDir)];
                    case 1:
                        _a.sent();
                        console.log("[\u5907\u4EFD] \u6062\u590D\u524D\u5907\u4EFD\u5DF2\u521B\u5EFA: ".concat(preRestoreBackup));
                        _a.label = 2;
                    case 2: 
                    // 从zip包中解压恢复
                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var extract = require('extract-zip');
                            var tmpExtractDir = path.join(_this.backupDir, "restore_tmp_".concat(Date.now()));
                            extract(backupPath, { dir: tmpExtractDir })
                                .then(function () {
                                try {
                                    // 恢复数据库文件
                                    var extractedDbPath = path.join(tmpExtractDir, 'mindvault.db');
                                    if (fs.existsSync(extractedDbPath)) {
                                        ensureDir(path.dirname(dbPath));
                                        fs.copyFileSync(extractedDbPath, dbPath);
                                        console.log("[\u5907\u4EFD] \u6570\u636E\u5E93\u5DF2\u4ECE\u5907\u4EFD\u6062\u590D");
                                    }
                                    // 恢复媒体目录
                                    var extractedMediaDir = path.join(tmpExtractDir, 'media');
                                    if (fs.existsSync(extractedMediaDir)) {
                                        ensureDir(path.dirname(mediaDir));
                                        if (fs.existsSync(mediaDir)) {
                                            fs.rmSync(mediaDir, { recursive: true, force: true });
                                        }
                                        fs.cpSync(extractedMediaDir, mediaDir, { recursive: true });
                                        console.log("[\u5907\u4EFD] \u5A92\u4F53\u6587\u4EF6\u5DF2\u4ECE\u5907\u4EFD\u6062\u590D");
                                    }
                                    // 清理临时目录
                                    fs.rmSync(tmpExtractDir, { recursive: true, force: true });
                                    console.log("[\u5907\u4EFD] \u5907\u4EFD\u5DF2\u6062\u590D: ".concat(backupPath));
                                    resolve();
                                }
                                catch (err) {
                                    // 清理临时目录
                                    fs.rmSync(tmpExtractDir, { recursive: true, force: true });
                                    reject(err);
                                }
                            })
                                .catch(reject);
                        })];
                    case 3:
                        // 从zip包中解压恢复
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 创建快速备份（用于恢复前的安全备份）
     */
    BackupService.prototype.createQuickBackup = function (backupPath, dbPath, mediaDir) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve, reject) {
                            var output = fs.createWriteStream(backupPath);
                            var archive = archiver('zip', { zlib: { level: 9 } });
                            output.on('close', resolve);
                            archive.on('error', reject);
                            archive.pipe(output);
                            if (fs.existsSync(dbPath)) {
                                archive.file(dbPath, { name: 'mindvault.db' });
                            }
                            if (fs.existsSync(mediaDir)) {
                                archive.directory(mediaDir, 'media');
                            }
                            archive.finalize();
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 设置自动备份
     * @param config - 自动备份配置
     */
    BackupService.prototype.setAutoBackup = function (config) {
        var _this = this;
        // 清除现有的定时器
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
        }
        // 保存配置
        var configPath = path.join(this.backupDir, 'auto_backup_config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        // 如果启用自动备份，设置定时器
        if (config.enabled) {
            var intervalMs = config.interval_minutes * 60 * 1000;
            this.autoBackupTimer = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
                var error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 2, , 3]);
                            return [4 /*yield*/, this.createBackup()];
                        case 1:
                            _a.sent();
                            return [3 /*break*/, 3];
                        case 2:
                            error_1 = _a.sent();
                            console.error('[备份] 自动备份失败:', error_1);
                            return [3 /*break*/, 3];
                        case 3: return [2 /*return*/];
                    }
                });
            }); }, intervalMs);
            console.log("[\u5907\u4EFD] \u81EA\u52A8\u5907\u4EFD\u5DF2\u542F\u7528\uFF0C\u95F4\u9694: ".concat(config.interval_minutes, "\u5206\u949F"));
        }
    };
    /**
     * 获取当前自动备份配置
     */
    BackupService.prototype.getAutoBackupConfig = function () {
        var configPath = path.join(this.backupDir, 'auto_backup_config.json');
        if (fs.existsSync(configPath)) {
            var content = fs.readFileSync(configPath, 'utf-8');
            return JSON.parse(content);
        }
        // 返回默认配置
        return {
            enabled: false,
            interval_minutes: 30,
            max_count: 10,
        };
    };
    /**
     * 获取备份列表
     */
    BackupService.prototype.listBackups = function () {
        var _this = this;
        if (!fs.existsSync(this.backupDir))
            return [];
        return fs.readdirSync(this.backupDir)
            .filter(function (file) { return file.startsWith('mindvault_backup_') && file.endsWith('.zip'); })
            .map(function (file) {
            var filePath = path.join(_this.backupDir, file);
            var stats = fs.statSync(filePath);
            return {
                path: filePath,
                size: stats.size,
                created_at: stats.birthtime.toISOString(),
            };
        })
            .sort(function (a, b) { return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); });
    };
    /**
     * 清理过期备份，保留最新的N个
     */
    BackupService.prototype.cleanOldBackups = function () {
        var config = this.getAutoBackupConfig();
        var backups = this.listBackups();
        if (backups.length > config.max_count) {
            var toDelete = backups.slice(config.max_count);
            for (var _i = 0, toDelete_1 = toDelete; _i < toDelete_1.length; _i++) {
                var backup = toDelete_1[_i];
                try {
                    fs.unlinkSync(backup.path);
                    console.log("[\u5907\u4EFD] \u5DF2\u6E05\u7406\u8FC7\u671F\u5907\u4EFD: ".concat(backup.path));
                }
                catch (error) {
                    console.error("[\u5907\u4EFD] \u6E05\u7406\u5907\u4EFD\u5931\u8D25: ".concat(backup.path), error);
                }
            }
        }
    };
    /**
     * 统计媒体文件数量
     */
    BackupService.prototype.countMediaFiles = function (mediaDir) {
        if (!fs.existsSync(mediaDir))
            return 0;
        return fs.readdirSync(mediaDir).length;
    };
    /**
     * 计算媒体文件总大小
     */
    BackupService.prototype.getMediaTotalSize = function (mediaDir) {
        if (!fs.existsSync(mediaDir))
            return 0;
        var totalSize = 0;
        var entries = fs.readdirSync(mediaDir, { withFileTypes: true });
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            var fullPath = path.join(mediaDir, entry.name);
            if (entry.isFile()) {
                totalSize += fs.statSync(fullPath).size;
            }
            else if (entry.isDirectory()) {
                totalSize += this.getMediaTotalSize(fullPath);
            }
        }
        return totalSize;
    };
    /**
     * 停止自动备份
     */
    BackupService.prototype.stopAutoBackup = function () {
        if (this.autoBackupTimer) {
            clearInterval(this.autoBackupTimer);
            this.autoBackupTimer = null;
            console.log('[备份] 自动备份已停止');
        }
    };
    return BackupService;
}());
export { BackupService };

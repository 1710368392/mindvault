// @ts-nocheck
/**
 * 数据库与存储层
 * 封装数据库连接、JsonStore降级存储、工具函数
 */
import path from 'path';
import fs from 'fs';
var db = null;
var userDataPath = '';
var mediaDir = '';
var backupDir = '';
function toCamelCase(obj) {
    if (!obj)
        return obj;
    var result = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        var camelKey = key.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
        result[camelKey] = obj[key];
    }
    return result;
}
function toSnakeCase(obj) {
    if (!obj)
        return obj;
    var result = {};
    for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
        var key = _a[_i];
        var snakeKey = key.replace(/([A-Z])/g, function (_, c) { return '_' + c.toLowerCase(); });
        result[snakeKey] = obj[key];
    }
    return result;
}
function mapRows(rows) {
    if (!rows || !Array.isArray(rows))
        return [];
    return rows.map(toCamelCase);
}
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
function getDataFilePath(name) {
    ensureDir(userDataPath);
    return path.join(userDataPath, name + '.json');
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
var JsonStore = {
    _data: {},
    init: function () {
        var filePath = getDataFilePath('store');
        try {
            if (fs.existsSync(filePath)) {
                this._data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        }
        catch (e) {
            console.error('[JsonStore] 读取数据失败:', e);
            this._data = {};
        }
        if (!this._data.creativities)
            this._data.creativities = [];
        if (!this._data.boards)
            this._data.boards = [];
        if (!this._data.tags)
            this._data.tags = [];
        if (!this._data.templates)
            this._data.templates = [];
        if (!this._data.settings)
            this._data.settings = {};
        if (!this._data.media)
            this._data.media = [];
        if (!this._data.trash)
            this._data.trash = [];
        this.save();
    },
    save: function () {
        var filePath = getDataFilePath('store');
        try {
            fs.writeFileSync(filePath, JSON.stringify(this._data, null, 2), 'utf-8');
        }
        catch (e) {
            console.error('[JsonStore] 保存数据失败:', e);
        }
    },
    get: function (key) {
        if (!this._data[key]) {
            var defaults = {
                creativities: [],
                boards: [],
                tags: [],
                templates: [],
                settings: {},
                media: [],
                trash: [],
                trashItems: [],
            };
            if (defaults[key] !== undefined) {
                this._data[key] = defaults[key];
            }
        }
        return this._data[key];
    },
    set: function (key, value) {
        this._data[key] = value;
        this.save();
    }
};
function initDatabase() {
    try {
        var Database = require('better-sqlite3');
        ensureDir(userDataPath);
        var dbPath = path.join(userDataPath, 'data.db');
        var newDb = null;
        try {
            newDb = new Database(dbPath);
            newDb.pragma('journal_mode = WAL');
            newDb.pragma('foreign_keys = ON');
        }
        catch (innerE) {
            console.error('[主进程] 数据库连接或配置失败:', innerE.message);
            if (newDb) {
                try {
                    newDb.close();
                }
                catch (_) { }
            }
            db = null;
            return false;
        }
        db = newDb;
        try {
            var tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creativities'").get();
            if (!tableCheck) {
                console.log('[数据库] 核心表不存在，将执行完整schema初始化');
            }
        }
        catch (e) {
            console.warn('[数据库] 表检查警告:', e.message);
        }
        var schemaPath = path.join(__dirname, 'schema.sql');
        if (fs.existsSync(schemaPath)) {
            var schema = fs.readFileSync(schemaPath, 'utf-8');
            try {
                db.exec(schema);
                console.log('[主进程] SQLite数据库初始化完成');
            }
            catch (schemaErr) {
                console.error('[主进程] schema.sql 执行失败，尝试逐条执行:', schemaErr.message);
                var statements = schema.split(';').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0 && !s.startsWith('--'); });
                for (var _i = 0, statements_1 = statements; _i < statements_1.length; _i++) {
                    var stmt = statements_1[_i];
                    try {
                        db.exec(stmt);
                    }
                    catch (stmtErr) {
                        if (!stmtErr.message.includes('already exists')) {
                            console.warn('[主进程] schema语句执行警告:', stmtErr.message, '| SQL:', stmt.substring(0, 80) + '...');
                        }
                    }
                }
                console.log('[主进程] SQLite数据库初始化完成(降级模式)');
            }
        }
        else {
            console.warn('[主进程] 未找到schema.sql:', schemaPath);
        }
        try {
            var edgeColumns = db.prepare("PRAGMA table_info(board_canvas_edges)").all();
            var columnNames = edgeColumns.map(function (c) { return c.name; });
            if (!columnNames.includes('source_connector')) {
                db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN source_connector TEXT').run();
                console.log('[数据库] 已添加 source_connector 列到 board_canvas_edges');
            }
            if (!columnNames.includes('target_connector')) {
                db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN target_connector TEXT').run();
                console.log('[数据库] 已添加 target_connector 列到 board_canvas_edges');
            }
        }
        catch (e) {
            console.warn('[数据库] board_canvas_edges 迁移警告:', e);
        }
        try {
            var canvasItemCols = db.prepare("PRAGMA table_info(board_canvas_items)").all().map(function (c) { return c.name; });
            if (!canvasItemCols.includes('video_loop_mode')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN video_loop_mode INTEGER DEFAULT 0').run();
                console.log('[数据库] 已添加 video_loop_mode 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('video_frozen_time')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN video_frozen_time REAL DEFAULT 0').run();
                console.log('[数据库] 已添加 video_frozen_time 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('subtype')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN subtype TEXT').run();
                console.log('[数据库] 已添加 subtype 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('card_style')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN card_style TEXT').run();
                console.log('[数据库] 已添加 card_style 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('priority')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN priority INTEGER DEFAULT 0').run();
                console.log('[数据库] 已添加 priority 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('emoji_reaction')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN emoji_reaction TEXT').run();
                console.log('[数据库] 已添加 emoji_reaction 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('is_favorite')) {
                db.prepare('ALTER TABLE board_canvas_items ADD COLUMN is_favorite INTEGER DEFAULT 0').run();
                console.log('[数据库] 已添加 is_favorite 列到 board_canvas_items');
            }
            if (!canvasItemCols.includes('content_format')) {
                db.prepare("ALTER TABLE board_canvas_items ADD COLUMN content_format TEXT DEFAULT 'markdown'").run();
                console.log('[数据库] 已添加 content_format 列到 board_canvas_items');
            }
        }
        catch (e) {
            console.warn('[数据库] board_canvas_items 迁移警告:', e);
        }
        try {
            var mediaTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media'").get();
            if (!mediaTableCheck) {
                db.exec("CREATE TABLE IF NOT EXISTS media (\n          id              TEXT PRIMARY KEY,\n          creativity_id   TEXT,\n          filename        TEXT NOT NULL,\n          filepath        TEXT NOT NULL,\n          mime_type       TEXT NOT NULL,\n          file_size       INTEGER NOT NULL,\n          width           INTEGER,\n          height          INTEGER,\n          thumbnail_path  TEXT,\n          sort_order      INTEGER DEFAULT 0,\n          created_at      TEXT NOT NULL,\n          FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE SET NULL\n        )");
                db.exec('CREATE INDEX IF NOT EXISTS idx_media_creativity_id ON media(creativity_id)');
                db.exec('CREATE INDEX IF NOT EXISTS idx_media_sort_order ON media(sort_order)');
                console.log('[数据库] 已创建缺失的 media 表');
            }
        }
        catch (e) {
            console.warn('[数据库] media 表迁移警告:', e);
        }
        try {
            var musicLibrary_1 = require('../services/music-library');
            musicLibrary_1.initMusicTable();
        }
        catch (e) {
            console.error('[数据库] 初始化音乐表失败:', e);
        }
        return true;
    }
    catch (e) {
        console.warn('[主进程] better-sqlite3 不可用，使用JSON文件存储:', e.message);
        db = null;
        return false;
    }
}
function setPaths(udp, md, bd) {
    userDataPath = udp;
    mediaDir = md;
    backupDir = bd;
}
function getDb() { return db; }
function setDb(v) { db = v; }
function getUserDataPath() { return userDataPath; }
function getMediaDir() { return mediaDir; }
function getBackupDir() { return backupDir; }
Object.defineProperty(exports, 'db', { get: getDb, enumerable: true });
Object.defineProperty(exports, 'mediaDir', { get: getMediaDir, enumerable: true });
Object.defineProperty(exports, 'userDataPath', { get: getUserDataPath, enumerable: true });
Object.defineProperty(exports, 'backupDir', { get: getBackupDir, enumerable: true });
export { setDb, JsonStore, toCamelCase, toSnakeCase, mapRows, ensureDir, getDataFilePath, generateId, escapeHtml, initDatabase, setPaths, };

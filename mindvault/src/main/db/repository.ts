// @ts-nocheck
/**
 * 数据库与存储层
 * 封装数据库连接、JsonStore降级存储、工具函数
 */

import path from 'path';
import fs from 'fs';

let db = null;
let userDataPath = '';
let mediaDir = '';
let backupDir = '';

function toCamelCase(obj) {
  if (!obj) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result;
}

function toSnakeCase(obj) {
  if (!obj) return obj;
  const result = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, (_, c) => '_' + c.toLowerCase());
    result[snakeKey] = obj[key];
  }
  return result;
}

function mapRows(rows) {
  if (!rows || !Array.isArray(rows)) return [];
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

const COLUMN_WHITELIST = {
  boards: ['name', 'description', 'background', 'theme', 'layout', 'sort_order', 'updated_at'],
  creativities: ['title', 'content', 'type', 'subtype', 'priority', 'emoji_reaction', 'status',
    'template_id', 'board_id', 'position_x', 'position_y', 'card_style', 'updated_at',
    'last_reviewed_at', 'is_read', 'is_favorite', 'content_format', 'word_count'],
  board_canvas_items: ['position_x', 'position_y', 'width', 'height', 'title', 'content',
    'type', 'subtype', 'card_style', 'priority', 'emoji_reaction', 'is_favorite',
    'content_format', 'is_linked', 'creativity_id', 'video_loop_mode', 'video_frozen_time'],
  board_canvas_edges: ['source_connector', 'target_connector', 'edge_type', 'label', 'control_points'],
  board_sticky_notes: ['title', 'content', 'color', 'position_x', 'position_y', 'width', 'height',
    'source_creativity_ids', 'sort_order', 'type', 'creative_chain_id', 'subtype', 'tags', 'updated_at'],
  board_graph_nodes: ['position_x', 'position_y', 'node_type', 'label', 'parent_id', 'creativity_id'],
  board_custom_folders: ['name', 'color', 'icon', 'sort_order'],
  creative_chains: ['name', 'description', 'tags', 'color', 'snapshot', 'updated_at'],
  tags: ['name', 'color', 'icon'],
  templates: ['name', 'description', 'category', 'config', 'updated_at'],
  writing_volumes: ['title', 'sort_order', 'updated_at'],
  writing_chapters: ['title', 'content', 'word_count', 'content_format', 'volume_id', 'sort_order', 'updated_at', 'last_saved_at'],
};

function safeBuildUpdate(table, data) {
  const allowed = COLUMN_WHITELIST[table];
  if (!allowed) throw new Error('Unknown table: ' + table);
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (!allowed.includes(col)) continue;
    fields.push(col + ' = ?');
    values.push(val);
  }
  if (fields.length === 0) return null;
  return { sql: 'UPDATE ' + table + ' SET ' + fields.join(', ') + ' WHERE id = ?', values };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const JsonStore = {
  _data: {},

  init() {
    const filePath = getDataFilePath('store');
    try {
      if (fs.existsSync(filePath)) {
        this._data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch (e) {
      console.error('[JsonStore] 读取数据失败:', e);
      this._data = {};
    }
    if (!this._data.creativities) this._data.creativities = [];
    if (!this._data.boards) this._data.boards = [];
    if (!this._data.tags) this._data.tags = [];
    if (!this._data.templates) this._data.templates = [];
    if (!this._data.settings) this._data.settings = {};
    if (!this._data.media) this._data.media = [];
    if (!this._data.trash) this._data.trash = [];
    this.save();
  },

  save() {
    const filePath = getDataFilePath('store');
    try {
      fs.writeFileSync(filePath, JSON.stringify(this._data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[JsonStore] 保存数据失败:', e);
    }
  },

  get(key) {
    if (!this._data[key]) {
      const defaults = {
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

  set(key, value) {
    this._data[key] = value;
    this.save();
  }
};

function initDatabase() {
  try {
    const Database = require('better-sqlite3');
    ensureDir(userDataPath);
    const dbPath = path.join(userDataPath, 'data.db');

    let newDb = null;
    try {
      newDb = new Database(dbPath);
      newDb.pragma('journal_mode = WAL');
      newDb.pragma('foreign_keys = ON');
    } catch (innerE) {
      console.error('[主进程] 数据库连接或配置失败:', innerE.message);
      if (newDb) { try { newDb.close(); } catch (_) {} }
      db = null;
      return false;
    }

    db = newDb;

    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creativities'").get();
      if (!tableCheck) {
        console.log('[数据库] 核心表不存在，将执行完整schema初始化');
      }
    } catch (e) {
      console.warn('[数据库] 表检查警告:', e.message);
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      try {
        db.exec(schema);
        console.log('[主进程] SQLite数据库初始化完成');
      } catch (schemaErr) {
        console.error('[主进程] schema.sql 执行失败，尝试逐条执行:', schemaErr.message);
        const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          try {
            db.exec(stmt);
          } catch (stmtErr) {
            if (!stmtErr.message.includes('already exists')) {
              console.warn('[主进程] schema语句执行警告:', stmtErr.message, '| SQL:', stmt.substring(0, 80) + '...');
            }
          }
        }
        console.log('[主进程] SQLite数据库初始化完成(降级模式)');
      }
    } else {
      console.warn('[主进程] 未找到schema.sql:', schemaPath);
    }

    try {
      const edgeColumns = db.prepare("PRAGMA table_info(board_canvas_edges)").all();
      const columnNames = edgeColumns.map((c) => c.name);
      if (!columnNames.includes('source_connector')) {
        db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN source_connector TEXT').run();
        console.log('[数据库] 已添加 source_connector 列到 board_canvas_edges');
      }
      if (!columnNames.includes('target_connector')) {
        db.prepare('ALTER TABLE board_canvas_edges ADD COLUMN target_connector TEXT').run();
        console.log('[数据库] 已添加 target_connector 列到 board_canvas_edges');
      }
    } catch (e) {
      console.warn('[数据库] board_canvas_edges 迁移警告:', e);
    }

    try {
      const canvasItemCols = db.prepare("PRAGMA table_info(board_canvas_items)").all().map((c: any) => c.name);
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
    } catch (e) {
      console.warn('[数据库] board_canvas_items 迁移警告:', e);
    }

    try {
      const fkCheck = db.pragma('foreign_keys');
      const fkList: any[] = db.pragma('foreign_key_list(board_canvas_items)');
      const needsFkMigration = fkList.some((fk: any) => fk.table === 'creativities' && fk.on_delete === 'CASCADE');
      if (needsFkMigration) {
        console.log('[数据库] 迁移 board_canvas_items 外键: CASCADE → SET NULL...');
        db.exec('PRAGMA foreign_keys = OFF');
        try { db.exec('DROP TABLE IF EXISTS board_canvas_items_new'); } catch {}
        db.exec(`
          CREATE TABLE board_canvas_items_new (
            id              TEXT PRIMARY KEY,
            board_id        TEXT NOT NULL,
            creativity_id   TEXT,
            position_x      REAL DEFAULT 0,
            position_y      REAL DEFAULT 0,
            width           REAL,
            height          REAL,
            title           TEXT,
            content         TEXT,
            type            TEXT,
            subtype         TEXT,
            card_style      TEXT,
            priority        INTEGER DEFAULT 0,
            emoji_reaction  TEXT,
            is_favorite     INTEGER DEFAULT 0,
            content_format  TEXT DEFAULT 'markdown',
            is_linked       INTEGER DEFAULT 0,
            video_loop_mode INTEGER DEFAULT 0,
            video_frozen_time REAL DEFAULT 0,
            created_at      TEXT NOT NULL,
            FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
            FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE SET NULL
          )
        `);
        const cols = ['id','board_id','creativity_id','position_x','position_y','width','height',
          'title','content','type','subtype','card_style','priority','emoji_reaction',
          'is_favorite','content_format','is_linked','video_loop_mode','video_frozen_time','created_at'];
        const existingCols = Object.keys(db.prepare('SELECT * FROM board_canvas_items LIMIT 1').columns?.() || {});
        const migrateCols = cols.filter(c => existingCols.includes(c) || c === 'creativity_id');
        db.exec(`INSERT OR IGNORE INTO board_canvas_items_new (${migrateCols.join(',')}) SELECT ${migrateCols.join(',')} FROM board_canvas_items`);
        db.exec('DROP TABLE board_canvas_items');
        db.exec('ALTER TABLE board_canvas_items_new RENAME TO board_canvas_items');
        db.exec('CREATE INDEX IF NOT EXISTS idx_board_canvas_items_board_id ON board_canvas_items(board_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_board_canvas_items_creativity_id ON board_canvas_items(creativity_id)');
        db.exec(`PRAGMA foreign_keys = ${fkCheck[0]?.foreign_keys || 0}`);
        console.log('[数据库] board_canvas_items 外键迁移完成');
      }
    } catch (e) {
      console.warn('[数据库] board_canvas_items 外键迁移警告:', e);
      try { db.exec('DROP TABLE IF EXISTS board_canvas_items_new'); } catch {}
      try { db.exec('PRAGMA foreign_keys = ON'); } catch {}
    }

    try {
      const mediaTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media'").get();
      if (!mediaTableCheck) {
        db.exec(`CREATE TABLE IF NOT EXISTS media (
          id              TEXT PRIMARY KEY,
          creativity_id   TEXT,
          filename        TEXT NOT NULL,
          filepath        TEXT NOT NULL,
          mime_type       TEXT NOT NULL,
          file_size       INTEGER NOT NULL,
          width           INTEGER,
          height          INTEGER,
          thumbnail_path  TEXT,
          sort_order      INTEGER DEFAULT 0,
          created_at      TEXT NOT NULL,
          FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE SET NULL
        )`);
        db.exec('CREATE INDEX IF NOT EXISTS idx_media_creativity_id ON media(creativity_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_media_sort_order ON media(sort_order)');
        console.log('[数据库] 已创建缺失的 media 表');
      }
    } catch (e) {
      console.warn('[数据库] media 表迁移警告:', e);
    }

    try {
      const musicLibrary = require('../services/music-library');
      musicLibrary.initMusicTable();
    } catch (e) {
      console.error('[数据库] 初始化音乐表失败:', e);
    }

    // RAG 表迁移：确保表存在，然后添加新字段
    try {
      // 先检查表是否存在
      const ragTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rag_embeddings'").get();
      if (!ragTableExists) {
        // 表不存在，创建完整表
        db.exec(`CREATE TABLE IF NOT EXISTS rag_embeddings (
          id              TEXT PRIMARY KEY,
          source_type     TEXT NOT NULL,
          source_id       TEXT NOT NULL,
          source_title    TEXT,
          source_status   TEXT DEFAULT 'active',
          content_hash    TEXT NOT NULL,
          content_chunk   TEXT NOT NULL,
          embedding       TEXT,
          embedding_model TEXT,
          chunk_index     INTEGER DEFAULT 0,
          indexed_at      TEXT,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        )`);
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source ON rag_embeddings(source_type, source_id)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_embeddings_content_hash ON rag_embeddings(content_hash)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source_status ON rag_embeddings(source_status)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_embeddings_model ON rag_embeddings(embedding_model)');
        console.log('[数据库] 已创建 rag_embeddings 表');
      } else {
        // 表存在，检查并添加缺失的列
        const ragCols = db.prepare("PRAGMA table_info(rag_embeddings)").all().map((c: any) => c.name);
        if (!ragCols.includes('source_title')) {
          db.prepare('ALTER TABLE rag_embeddings ADD COLUMN source_title TEXT').run();
          console.log('[数据库] 已添加 source_title 列到 rag_embeddings');
        }
        if (!ragCols.includes('source_status')) {
          db.prepare("ALTER TABLE rag_embeddings ADD COLUMN source_status TEXT DEFAULT 'active'").run();
          console.log('[数据库] 已添加 source_status 列到 rag_embeddings');
        }
        if (!ragCols.includes('embedding_model')) {
          db.prepare('ALTER TABLE rag_embeddings ADD COLUMN embedding_model TEXT').run();
          console.log('[数据库] 已添加 embedding_model 列到 rag_embeddings');
        }
        if (!ragCols.includes('indexed_at')) {
          db.prepare('ALTER TABLE rag_embeddings ADD COLUMN indexed_at TEXT').run();
          console.log('[数据库] 已添加 indexed_at 列到 rag_embeddings');
        }
        
        // 创建索引
        db.exec("CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source_status ON rag_embeddings(source_status)");
        db.exec("CREATE INDEX IF NOT EXISTS idx_rag_embeddings_model ON rag_embeddings(embedding_model)");
      }
    } catch (e) {
      console.warn('[数据库] rag_embeddings 迁移警告:', e);
    }

    // 创建 RAG 日志表
    try {
      const ragLogsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rag_index_logs'").get();
      if (!ragLogsTable) {
        db.exec(`CREATE TABLE IF NOT EXISTS rag_index_logs (
          id              TEXT PRIMARY KEY,
          action          TEXT NOT NULL,
          source_type     TEXT NOT NULL,
          source_id       TEXT,
          chunks_count    INTEGER DEFAULT 0,
          status          TEXT NOT NULL,
          error_message   TEXT,
          duration_ms     INTEGER,
          embedding_model TEXT,
          created_at      TEXT NOT NULL
        )`);
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_logs_created ON rag_index_logs(created_at)');
        db.exec('CREATE INDEX IF NOT EXISTS idx_rag_logs_source ON rag_index_logs(source_type, source_id)');
        console.log('[数据库] 已创建 rag_index_logs 表');
      }
    } catch (e) {
      console.warn('[数据库] rag_index_logs 表创建警告:', e);
    }

    // FTS5 全文搜索虚拟表健康检查与自动修复
    try {
      const ftsCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='creativities_fts'").get();
      if (ftsCheck) {
        let needsRepair = false;
        try {
          db.exec("INSERT INTO creativities_fts(creativities_fts) VALUES('integrity-check')");
        } catch (ftsErr: any) {
          needsRepair = true;
          console.warn('[数据库] FTS5 完整性检查失败:', ftsErr.message);
        }
        if (!needsRepair) {
          try {
            db.prepare("SELECT * FROM creativities_fts LIMIT 1").get();
          } catch (ftsErr2: any) {
            if (ftsErr2 && (ftsErr2.code === 'SQLITE_CORRUPT_VTAB' || ftsErr2.code === 'SQLITE_CORRUPT' || ftsErr2.message?.includes('malformed'))) {
              needsRepair = true;
            }
          }
        }
        if (needsRepair) {
          repairFts5(db);
        }
      }
    } catch (e) {
      console.error('[数据库] FTS5 健康检查失败:', e);
    }

    // 迁移：将旧的 status='trashed' 创意补录到 trash_items 表
    try {
      const trashedWithoutTrashEntry = db.prepare(`
        SELECT c.id, c.title, c.content, c.type, c.subtype, c.board_id, c.updated_at
        FROM creativities c
        WHERE c.status = 'trashed'
          AND NOT EXISTS (
            SELECT 1 FROM trash_items t
            WHERE t.item_id = c.id AND t.item_type IN ('creativity', 'chapter')
          )
      `).all();

      if (trashedWithoutTrashEntry.length > 0) {
        console.log(`[数据库] 发现 ${trashedWithoutTrashEntry.length} 条旧格式已删除创意，正在迁移到 trash_items...`);
        const insertTrash = db.prepare(
          'INSERT INTO trash_items (id, item_type, item_id, source_board_id, source_board_name, snapshot, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        const getTags = db.prepare(
          'SELECT t.id, t.name, t.color FROM tags t INNER JOIN creativity_tags ct ON t.id = ct.tag_id WHERE ct.creativity_id = ?'
        );

        const migrate = db.transaction(() => {
          for (const c of trashedWithoutTrashEntry) {
            const tags = getTags.all(c.id);
            const snapshot = {
              id: c.id,
              title: c.title || '',
              content: c.content || '',
              type: c.type,
              subtype: c.subtype,
              boardId: c.board_id,
              updatedAt: c.updated_at,
              tags: tags.map((t: any) => ({ id: t.id, name: t.name, color: t.color })),
            };
            const isChapter = c.subtype === 'chapter';
            insertTrash.run(
              'migrate-' + c.id,
              isChapter ? 'chapter' : 'creativity',
              c.id,
              c.board_id || null,
              null,
              JSON.stringify(snapshot),
              c.updated_at || new Date().toISOString()
            );
          }
        });
        migrate();
        console.log(`[数据库] 已迁移 ${trashedWithoutTrashEntry.length} 条创意到 trash_items`);
      }
    } catch (e) {
      console.error('[数据库] trash_items 迁移失败:', e);
    }

    return true;
  } catch (e) {
    console.warn('[主进程] better-sqlite3 不可用，使用JSON文件存储:', e.message);
    db = null;
    return false;
  }
}

function repairFts5(database) {
  if (!database) return false;
  try {
    console.warn('[数据库] FTS5 虚拟表损坏，正在重建...');
    database.exec("DROP TRIGGER IF EXISTS creativities_ai");
    database.exec("DROP TRIGGER IF EXISTS creativities_ad");
    database.exec("DROP TRIGGER IF EXISTS creativities_au");
    database.exec("DROP TABLE IF EXISTS creativities_fts");
    database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS creativities_fts USING fts5(
      title,
      content,
      content='creativities',
      content_rowid='rowid',
      tokenize='unicode61'
    )`);
    database.exec(`CREATE TRIGGER creativities_ai AFTER INSERT ON creativities BEGIN
      INSERT INTO creativities_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END`);
    database.exec(`CREATE TRIGGER creativities_ad AFTER DELETE ON creativities BEGIN
      INSERT INTO creativities_fts(creativities_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
    END`);
    database.exec(`CREATE TRIGGER creativities_au AFTER UPDATE ON creativities BEGIN
      INSERT INTO creativities_fts(creativities_fts, rowid, title, content) VALUES('delete', old.rowid, old.title, old.content);
      INSERT INTO creativities_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END`);
    database.exec(`INSERT INTO creativities_fts(rowid, title, content) SELECT rowid, title, content FROM creativities`);
    console.log('[数据库] FTS5 虚拟表重建完成');
    return true;
  } catch (e) {
    console.error('[数据库] FTS5 重建失败:', e);
    return false;
  }
}

function isCorruptVtabError(err) {
  if (!err) return false;
  return err.code === 'SQLITE_CORRUPT_VTAB'
    || err.code === 'SQLITE_CORRUPT'
    || (err.message && err.message.includes('malformed'));
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

Object.defineProperty(exports, 'safeBuildUpdate', { value: safeBuildUpdate, enumerable: true });
Object.defineProperty(exports, 'repairFts5', { value: repairFts5, enumerable: true });
Object.defineProperty(exports, 'isCorruptVtabError', { value: isCorruptVtabError, enumerable: true });

export {
  getDb,
  setDb,
  JsonStore,
  toCamelCase,
  toSnakeCase,
  mapRows,
  ensureDir,
  getDataFilePath,
  generateId,
  escapeHtml,
  initDatabase,
  setPaths,
  repairFts5,
  isCorruptVtabError,
};

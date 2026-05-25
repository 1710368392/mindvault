-- ============================================================
-- 脑洞集(MindVault) 数据库表结构
-- 使用 SQLite (better-sqlite3)
-- ============================================================

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ============================================================
-- 创意表 (creativities)
-- 存储所有创意记录的核心数据
-- ============================================================
CREATE TABLE IF NOT EXISTS creativities (
    id                TEXT PRIMARY KEY,          -- UUID主键
    title             TEXT NOT NULL,             -- 创意标题
    content           TEXT DEFAULT '',           -- 创意内容（富文本/Markdown）
    type              TEXT DEFAULT 'text' NOT NULL, -- 类型：text, image, audio, video, link
    priority          INTEGER DEFAULT 0,         -- 优先级：0=无, 1-5星
    emoji_reaction    TEXT,                      -- Emoji 反应
    status            TEXT DEFAULT 'active' NOT NULL, -- 状态：active, archived, trashed
    template_id       TEXT,                      -- 关联模板ID
    board_id          TEXT,                      -- 关联看板ID
    position_x        REAL,                      -- 画布X坐标
    position_y        REAL,                      -- 画布Y坐标
    card_style        TEXT,                      -- 卡片样式（JSON字符串）
    subtype           TEXT,                      -- 写作子类型：idea, outline, character, scene, dialogue, chapter, worldbuilding, plot
    content_format    TEXT DEFAULT 'plain',      -- 内容格式：plain, markdown
    word_count        INTEGER DEFAULT 0,         -- 字数统计
    is_read           INTEGER DEFAULT 1,         -- 是否已读：0=未读, 1=已读
    is_favorite       INTEGER DEFAULT 0,         -- 是否收藏：0=否, 1=是
    created_at        TEXT NOT NULL,             -- 创建时间 (ISO 8601)
    updated_at        TEXT NOT NULL,             -- 更新时间 (ISO 8601)
    last_reviewed_at  TEXT                       -- 最后查看时间 (ISO 8601)
);

-- ============================================================
-- 标签表 (tags)
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,              -- UUID主键
    name        TEXT NOT NULL UNIQUE,          -- 标签名称（唯一）
    color       TEXT DEFAULT '#6366f1',        -- 标签颜色
    icon        TEXT,                          -- 标签图标
    created_at  TEXT NOT NULL                  -- 创建时间
);

-- ============================================================
-- 创意-标签关联表 (creativity_tags)
-- 多对多关系
-- ============================================================
CREATE TABLE IF NOT EXISTS creativity_tags (
    creativity_id   TEXT NOT NULL,
    tag_id          TEXT NOT NULL,
    PRIMARY KEY (creativity_id, tag_id),
    FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- ============================================================
-- 看板表 (boards)
-- ============================================================
CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,              -- UUID主键
    name        TEXT NOT NULL,                 -- 看板名称
    description TEXT DEFAULT '',               -- 看板描述
    background  TEXT,                          -- 看板背景
    theme       TEXT,                          -- 看板主题
    layout      TEXT DEFAULT 'board' NOT NULL, -- 布局：board, canvas, graph, folder
    sort_order  INTEGER DEFAULT 0,             -- 排序顺序
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- ============================================================
-- 模板表 (templates)
-- 预设的创意模板
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,              -- UUID主键
    name        TEXT NOT NULL,                 -- 模板名称
    description TEXT DEFAULT '',               -- 模板描述
    category    TEXT,                          -- 适用分类（如：产品、写作、旅行、学习、效率、阅读）
    config      TEXT DEFAULT '{}',             -- 模板配置（JSON字符串）
    is_builtin  INTEGER DEFAULT 0,             -- 是否为内置模板
    created_at  TEXT NOT NULL                  -- 创建时间
);

-- ============================================================
-- 设置表 (settings)
-- 键值对存储应用设置
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,              -- 设置键名
    value       TEXT NOT NULL                  -- 设置值（JSON字符串）
);

-- ============================================================
-- 创建索引以提高查询性能
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_creativities_type ON creativities(type);
CREATE INDEX IF NOT EXISTS idx_creativities_status ON creativities(status);
CREATE INDEX IF NOT EXISTS idx_creativities_priority ON creativities(priority);
CREATE INDEX IF NOT EXISTS idx_creativities_created_at ON creativities(created_at);
CREATE INDEX IF NOT EXISTS idx_creativities_updated_at ON creativities(updated_at);
CREATE INDEX IF NOT EXISTS idx_creativities_board_id ON creativities(board_id);
CREATE INDEX IF NOT EXISTS idx_creativities_template_id ON creativities(template_id);
CREATE INDEX IF NOT EXISTS idx_creativities_is_read ON creativities(is_read);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

CREATE INDEX IF NOT EXISTS idx_creativity_tags_tag_id ON creativity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_creativity_tags_creativity_id ON creativity_tags(creativity_id);

CREATE INDEX IF NOT EXISTS idx_boards_sort_order ON boards(sort_order);
CREATE INDEX IF NOT EXISTS idx_boards_layout ON boards(layout);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_builtin ON templates(is_builtin);

-- ============================================================
-- 插入默认系统模板
-- ============================================================
INSERT OR IGNORE INTO templates (id, name, description, category, config, is_builtin, created_at) VALUES
('tpl-blank', '空白创意', '从零开始记录你的创意', NULL, '{}', 1, datetime('now')),
('tpl-product', '产品灵感', '记录产品相关的创意和想法', '产品', '{"content": "## 产品灵感\n\n### 产品名称\n\n### 目标用户\n\n### 核心功能\n1. \n2. \n3. \n\n### 竞品分析\n- \n\n### 创新点\n- \n\n### 下一步行动\n- [ ] "}', 1, datetime('now')),
('tpl-writing', '写作素材', '收集和整理写作相关的素材', '写作', '{"content": "## 写作素材\n\n### 主题\n\n### 灵感来源\n\n### 关键词\n- \n- \n- \n\n### 参考素材\n\n### 大纲\n1. \n2. \n3. \n\n### 初稿\n\n"}', 1, datetime('now')),
('tpl-travel', '旅行计划', '规划旅行行程和记录旅途见闻', '旅行', '{"content": "## 旅行计划\n\n### 目的地\n\n### 出行日期\n- **出发**：\n- **返回**：\n\n### 行程安排\n#### Day 1\n- \n\n#### Day 2\n- \n\n### 预算\n| 项目 | 预算 | 实际 |\n|------|------|------|\n| 交通 | | |\n| 住宿 | | |\n| 餐饮 | | |\n| 门票 | | |\n\n### 必备物品\n- [ ] \n\n### 旅途见闻\n\n"}', 1, datetime('now')),
('tpl-study', '学习笔记', '记录学习内容和心得体会', '学习', '{"content": "## 学习笔记\n\n### 学科/主题\n\n### 学习目标\n- [ ] \n\n### 核心概念\n1. \n2. \n3. \n\n### 详细笔记\n\n### 重点总结\n\n### 疑问与思考\n\n### 复习计划\n- [ ] \n"}', 1, datetime('now')),
('tpl-efficiency', '效率工具', '优化工作流程和提升效率的方法', '效率', '{"content": "## 效率优化\n\n### 当前痛点\n1. \n2. \n\n### 优化目标\n\n### 解决方案\n1. \n2. \n3. \n\n### 工具推荐\n- \n\n### 实施计划\n- [ ] \n\n### 效果评估\n\n"}', 1, datetime('now')),
('tpl-reading', '阅读笔记', '记录阅读心得和书籍摘要', '阅读', '{"content": "## 阅读笔记\n\n### 书名\n\n### 作者\n\n### 阅读日期\n\n### 摘要\n\n### 精彩摘录\n> \n\n### 个人感悟\n\n### 行动启发\n- [ ] \n\n### 推荐指数\n⭐⭐⭐⭐⭐\n"}', 1, datetime('now'));

-- ============================================================
-- 插入默认应用设置
-- ============================================================
INSERT OR IGNORE INTO settings (key, value) VALUES
('theme', '"light"'),
('language', '"zh-CN"'),
('autoBackup', 'true'),
('autoBackupInterval', '"30"'),
('fontSize', '"14"'),
('fontFamily', '''PingFang SC'', ''Microsoft YaHei'', ''Hiragino Sans GB'', sans-serif'),
('fontLineHeight', '"1.6"'),
('titleFontFamily', '''PingFang SC'', ''Microsoft YaHei'', sans-serif'),
('soundEnabled', 'true'),
('soundVolume', '"0.5"'),
('privacyLock', 'false'),
('privacyPassword', 'null'),
('customTheme', 'null');

-- ============================================================
-- 看板-创意多对多关联表 (board_creativities)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_creativities (
    board_id         TEXT NOT NULL,
    creativity_id    TEXT NOT NULL,
    PRIMARY KEY (board_id, creativity_id),
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE CASCADE
);

-- ============================================================
-- 画布放置项表 (board_canvas_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_canvas_items (
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
);
-- 注意：独立卡片（is_linked=0）的creativity_id为NULL，不会被级联删除。
-- 互通卡片（is_linked=1）的creativity_id指向创意，创意删除后creativity_id被置NULL。

-- ============================================================
-- 画布连线表 (board_canvas_edges)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_canvas_edges (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    source_item_id  TEXT NOT NULL,
    target_item_id  TEXT NOT NULL,
    edge_type       TEXT DEFAULT 'related',
    label           TEXT,
    source_connector TEXT,
    target_connector TEXT,
    control_points   TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- ============================================================
-- 看板便签表 (board_sticky_notes)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_sticky_notes (
    id                    TEXT PRIMARY KEY,
    board_id              TEXT NOT NULL,
    title                 TEXT DEFAULT '',
    content               TEXT DEFAULT '',
    color                 TEXT DEFAULT '#FFF9C4',
    position_x            REAL DEFAULT 0,
    position_y            REAL DEFAULT 0,
    width                 REAL DEFAULT 200,
    height                REAL DEFAULT 150,
    source_creativity_ids TEXT,
    sort_order            INTEGER DEFAULT 0,
    type                  TEXT DEFAULT 'note',
    creative_chain_id     TEXT,
    subtype               TEXT,
    tags                  TEXT,
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- ============================================================
-- 图谱节点表 (board_graph_nodes) - 树结构
-- ============================================================
CREATE TABLE IF NOT EXISTS board_graph_nodes (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    creativity_id   TEXT,
    parent_id       TEXT,
    position_x      REAL,
    position_y      REAL,
    node_type       TEXT DEFAULT 'creativity',
    label           TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES board_graph_nodes(id) ON DELETE SET NULL
);

-- ============================================================
-- 图谱连线表 (board_graph_edges)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_graph_edges (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    source_node_id  TEXT NOT NULL,
    target_node_id  TEXT NOT NULL,
    edge_type       TEXT DEFAULT 'child',
    created_at      TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- ============================================================
-- 自定义文件夹表 (board_custom_folders)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_custom_folders (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    icon        TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- ============================================================
-- 文件夹-创意关联表 (board_folder_items)
-- ============================================================
CREATE TABLE IF NOT EXISTS board_folder_items (
    folder_id      TEXT NOT NULL,
    creativity_id  TEXT NOT NULL,
    PRIMARY KEY (folder_id, creativity_id),
    FOREIGN KEY (folder_id) REFERENCES board_custom_folders(id) ON DELETE CASCADE,
    FOREIGN KEY (creativity_id) REFERENCES creativities(id) ON DELETE CASCADE
);

-- ============================================================
-- 创意关联表 (creativity_links)
-- ============================================================
CREATE TABLE IF NOT EXISTS creativity_links (
    id             TEXT PRIMARY KEY,
    source_id      TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    relation_type  TEXT DEFAULT 'related' NOT NULL,
    created_at     TEXT NOT NULL,
    FOREIGN KEY (source_id) REFERENCES creativities(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES creativities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creativity_links_source_id ON creativity_links(source_id);
CREATE INDEX IF NOT EXISTS idx_creativity_links_target_id ON creativity_links(target_id);
CREATE INDEX IF NOT EXISTS idx_creativity_links_relation_type ON creativity_links(relation_type);

-- ============================================================
-- 媒体文件表 (media)
-- ============================================================
CREATE TABLE IF NOT EXISTS media (
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
);

CREATE INDEX IF NOT EXISTS idx_media_creativity_id ON media(creativity_id);
CREATE INDEX IF NOT EXISTS idx_media_sort_order ON media(sort_order);

-- ============================================================
-- 新表索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_board_creativities_board_id ON board_creativities(board_id);
CREATE INDEX IF NOT EXISTS idx_board_creativities_creativity_id ON board_creativities(creativity_id);

CREATE INDEX IF NOT EXISTS idx_board_canvas_items_board_id ON board_canvas_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_canvas_items_creativity_id ON board_canvas_items(creativity_id);

CREATE INDEX IF NOT EXISTS idx_board_canvas_edges_board_id ON board_canvas_edges(board_id);
CREATE INDEX IF NOT EXISTS idx_board_canvas_edges_source_item_id ON board_canvas_edges(source_item_id);
CREATE INDEX IF NOT EXISTS idx_board_canvas_edges_target_item_id ON board_canvas_edges(target_item_id);

CREATE INDEX IF NOT EXISTS idx_board_sticky_notes_board_id ON board_sticky_notes(board_id);
CREATE INDEX IF NOT EXISTS idx_board_sticky_notes_sort_order ON board_sticky_notes(sort_order);

CREATE INDEX IF NOT EXISTS idx_board_graph_nodes_board_id ON board_graph_nodes(board_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_nodes_creativity_id ON board_graph_nodes(creativity_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_nodes_parent_id ON board_graph_nodes(parent_id);

CREATE INDEX IF NOT EXISTS idx_board_graph_edges_board_id ON board_graph_edges(board_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_edges_source_node_id ON board_graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_edges_target_node_id ON board_graph_edges(target_node_id);

-- ============================================================
-- 创意链表 - 存储打包的创意链
-- ============================================================
CREATE TABLE IF NOT EXISTS creative_chains (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '未命名创意链',
  description TEXT,
  tags TEXT, -- JSON array
  color TEXT,
  snapshot TEXT NOT NULL, -- JSON: { items, edges }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creative_chains_board_id ON creative_chains(board_id);
CREATE INDEX IF NOT EXISTS idx_creative_chains_created_at ON creative_chains(created_at);

CREATE INDEX IF NOT EXISTS idx_board_custom_folders_board_id ON board_custom_folders(board_id);
CREATE INDEX IF NOT EXISTS idx_board_custom_folders_sort_order ON board_custom_folders(sort_order);

CREATE INDEX IF NOT EXISTS idx_board_folder_items_folder_id ON board_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_board_folder_items_creativity_id ON board_folder_items(creativity_id);

-- ============================================================
-- 回收站表 (trash_items) - 已扩展
-- ============================================================
CREATE TABLE IF NOT EXISTS trash_items (
    id              TEXT PRIMARY KEY,
    item_type       TEXT NOT NULL,
    item_id         TEXT NOT NULL,
    source_board_id TEXT,
    source_board_name TEXT,
    snapshot        TEXT NOT NULL,
    deleted_at      TEXT NOT NULL,
    -- 扩展字段
    file_size       INTEGER DEFAULT 0,              -- 文件大小（字节）
    version_count   INTEGER DEFAULT 1,             -- 版本数量
    tags            TEXT,                         -- 标签（JSON 数组）
    smart_labels    TEXT,                         -- 智能标签（JSON）
    metadata        TEXT,                         -- 元数据（JSON）
    cloud_status    TEXT DEFAULT 'local',          -- 云同步状态：local, syncing, synced, error
    cloud_id        TEXT,                         -- 云端ID（预留）
    access_count    INTEGER DEFAULT 0,            -- 访问次数（恢复前预览等）
    last_accessed   TEXT,                         -- 最后访问时间
    original_created_at TEXT,                      -- 原始创建时间
    notes           TEXT                          -- 用户备注（如删除原因）
);

CREATE INDEX IF NOT EXISTS idx_trash_items_item_type ON trash_items(item_type);
CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON trash_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_trash_items_cloud_status ON trash_items(cloud_status);

-- ============================================================
-- 回收站版本历史表 (trash_versions) - 新增
-- ============================================================
CREATE TABLE IF NOT EXISTS trash_versions (
    id                  TEXT PRIMARY KEY,
    trash_item_id       TEXT NOT NULL,
    version_data        TEXT NOT NULL,            -- 版本快照（JSON）
    version_number      INTEGER NOT NULL,         -- 版本号
    created_at          TEXT NOT NULL,            -- 创建时间
    change_description  TEXT,                     -- 变更描述
    created_by          TEXT,                     -- 创建人（预留，协作功能）
    FOREIGN KEY (trash_item_id) REFERENCES trash_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trash_versions_item_id ON trash_versions(trash_item_id);
CREATE INDEX IF NOT EXISTS idx_trash_versions_version_number ON trash_versions(version_number);

-- ============================================================
-- 回收站操作历史表 (trash_history) - 新增
-- ============================================================
CREATE TABLE IF NOT EXISTS trash_history (
    id              TEXT PRIMARY KEY,
    action          TEXT NOT NULL,                -- 操作类型：restore, delete, permanent_delete, move, batch_restore, batch_delete, auto_clean
    trash_item_id   TEXT,                         -- 关联的回收站项ID
    item_title      TEXT NOT NULL,                -- 项目标题（方便查看）
    item_type       TEXT,                         -- 项目类型
    operator        TEXT,                         -- 操作人（预留，协作功能）
    target_info     TEXT,                         -- 目标信息（JSON）- 恢复目标等
    created_at      TEXT NOT NULL,                -- 操作时间
    cloud_synced    TEXT DEFAULT 'pending',       -- 云同步状态：pending, synced, error
    description     TEXT,                         -- 操作描述
    metadata        TEXT                          -- 额外元数据（JSON）
);

CREATE INDEX IF NOT EXISTS idx_trash_history_action ON trash_history(action);
CREATE INDEX IF NOT EXISTS idx_trash_history_created_at ON trash_history(created_at);
CREATE INDEX IF NOT EXISTS idx_trash_history_item_id ON trash_history(trash_item_id);

-- ============================================================
-- 回收站设置表 (trash_settings) - 新增
-- ============================================================
CREATE TABLE IF NOT EXISTS trash_settings (
    key                 TEXT PRIMARY KEY,
    value               TEXT NOT NULL,             -- 设置值（JSON）
    description         TEXT,                      -- 设置描述
    updated_at          TEXT NOT NULL              -- 更新时间
);

-- 插入默认回收站设置
INSERT OR IGNORE INTO trash_settings (key, value, description, updated_at) VALUES
('autoCleanEnabled', 'false', '是否启用自动清理', datetime('now')),
('autoCleanDays', '30', '自动清理保留天数', datetime('now')),
('maxCapacityMB', '500', '最大容量（MB）', datetime('now')),
('notificationEnabled', 'true', '是否启用回收站通知', datetime('now')),
('cloudSyncEnabled', 'false', '是否启用云同步（预留）', datetime('now')),
('cloudSyncProvider', 'null', '云同步提供商（预留）', datetime('now')),
('lastCleanTime', 'null', '上次清理时间', datetime('now')),
('smartCleanEnabled', 'false', '是否启用智能清理（AI建议）', datetime('now'));

-- ============================================================
-- 写作台独立存储表 (与创意库完全分离)
-- ============================================================

-- 写作台卷表
CREATE TABLE IF NOT EXISTS writing_volumes (
    id          TEXT PRIMARY KEY,
    board_id    TEXT,
    title       TEXT NOT NULL DEFAULT '新卷',
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_writing_volumes_board_id ON writing_volumes(board_id);
CREATE INDEX IF NOT EXISTS idx_writing_volumes_sort_order ON writing_volumes(sort_order);

-- 写作台章节表 (独立存储，不属于创意库)
CREATE TABLE IF NOT EXISTS writing_chapters (
    id              TEXT PRIMARY KEY,
    volume_id       TEXT,
    board_id        TEXT,
    title           TEXT NOT NULL DEFAULT '新章节',
    content         TEXT DEFAULT '',
    word_count      INTEGER DEFAULT 0,
    content_format  TEXT DEFAULT 'plain',
    sort_order      INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_saved_at   TEXT,
    FOREIGN KEY (volume_id) REFERENCES writing_volumes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_writing_chapters_volume_id ON writing_chapters(volume_id);
CREATE INDEX IF NOT EXISTS idx_writing_chapters_board_id ON writing_chapters(board_id);
CREATE INDEX IF NOT EXISTS idx_writing_chapters_sort_order ON writing_chapters(sort_order);
CREATE INDEX IF NOT EXISTS idx_writing_chapters_updated_at ON writing_chapters(updated_at);

-- 写作台自动备份表 (防止数据丢失)
CREATE TABLE IF NOT EXISTS writing_backups (
    id              TEXT PRIMARY KEY,
    chapter_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    word_count      INTEGER DEFAULT 0,
    backup_type     TEXT DEFAULT 'auto',  -- auto, manual, exit
    created_at      TEXT NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES writing_chapters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_writing_backups_chapter_id ON writing_backups(chapter_id);
CREATE INDEX IF NOT EXISTS idx_writing_backups_created_at ON writing_backups(created_at);

-- ============================================================
-- AI 聊天记录表
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_windows (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL DEFAULT '新对话',
    is_pinned       INTEGER DEFAULT 0,
    is_archived     INTEGER DEFAULT 0,
    group_name      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id                  TEXT PRIMARY KEY,
    window_id           TEXT NOT NULL,
    role                TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content             TEXT NOT NULL DEFAULT '',
    reasoning_content   TEXT,
    reasoning_collapsed INTEGER DEFAULT 0,
    tool_calls          TEXT,
    model               TEXT,
    provider            TEXT,
    token_count         INTEGER,
    feedback            INTEGER,
    created_at          TEXT NOT NULL,
    FOREIGN KEY (window_id) REFERENCES chat_windows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_windows_updated_at ON chat_windows(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_windows_is_pinned ON chat_windows(is_pinned);
CREATE INDEX IF NOT EXISTS idx_chat_windows_is_archived ON chat_windows(is_archived);
CREATE INDEX IF NOT EXISTS idx_chat_messages_window_id ON chat_messages(window_id, created_at);

-- Prompt 模板表
CREATE TABLE IF NOT EXISTS prompt_templates (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL,
    template        TEXT NOT NULL,
    variables       TEXT,
    is_preset       INTEGER DEFAULT 0,
    use_count       INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);

-- AI 规则表（替代全局记忆）
-- 用户自定义提示词规则，在对话时自动注入到 System Prompt
CREATE TABLE IF NOT EXISTS ai_rules (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,                 -- 规则名称
    content         TEXT NOT NULL,                 -- 规则内容（Markdown格式）
    type            TEXT NOT NULL DEFAULT 'global', -- 规则类型：global（全局）或 project（项目）
    scope           TEXT,                          -- 生效范围（预留，用于项目级规则）
    apply_mode      TEXT DEFAULT 'always',         -- 生效方式：always（始终生效）或 manual（手动触发）
    description     TEXT,                          -- 规则描述
    sort_order      INTEGER DEFAULT 0,             -- 排序权重
    enabled         INTEGER DEFAULT 1,             -- 是否启用：0=禁用, 1=启用
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_rules_type ON ai_rules(type);
CREATE INDEX IF NOT EXISTS idx_ai_rules_enabled ON ai_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_rules_sort_order ON ai_rules(sort_order);

-- RAG 向量索引表（增强版）
CREATE TABLE IF NOT EXISTS rag_embeddings (
    id              TEXT PRIMARY KEY,
    source_type     TEXT NOT NULL,
    source_id       TEXT NOT NULL,
    source_title    TEXT,                         -- 数据源标题
    source_status   TEXT DEFAULT 'active',        -- 数据源状态：active, trashed
    content_hash    TEXT NOT NULL,
    content_chunk   TEXT NOT NULL,
    embedding       TEXT,
    embedding_model TEXT,                         -- 使用的 Embedding 模型
    chunk_index     INTEGER DEFAULT 0,
    indexed_at      TEXT,                         -- 索引时间
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source ON rag_embeddings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_content_hash ON rag_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_source_status ON rag_embeddings(source_status);
CREATE INDEX IF NOT EXISTS idx_rag_embeddings_model ON rag_embeddings(embedding_model);

-- RAG 索引日志表
CREATE TABLE IF NOT EXISTS rag_index_logs (
    id              TEXT PRIMARY KEY,
    action          TEXT NOT NULL,                -- index / delete / rebuild / clear
    source_type     TEXT NOT NULL,
    source_id       TEXT,
    chunks_count    INTEGER DEFAULT 0,
    status          TEXT NOT NULL,                -- success / failed / partial
    error_message   TEXT,
    duration_ms     INTEGER,
    embedding_model TEXT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_logs_created ON rag_index_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_logs_source ON rag_index_logs(source_type, source_id);

CREATE TABLE IF NOT EXISTS weather_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    city            TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    temperature     INTEGER NOT NULL,
    apparent_temp   INTEGER,
    weather_code    INTEGER NOT NULL,
    humidity        INTEGER,
    wind_speed      INTEGER,
    pressure        INTEGER,
    is_day          INTEGER DEFAULT 1,
    snapshot_date   TEXT NOT NULL,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_date ON weather_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_city ON weather_snapshots(city);

-- AI 自定义工作流表
CREATE TABLE IF NOT EXISTS ai_workflows (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT DEFAULT '',
    icon            TEXT DEFAULT '⚙️',
    steps           TEXT NOT NULL DEFAULT '[]',
    is_preset       INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 0,
    run_count       INTEGER DEFAULT 0,
    last_run_at     TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_workflows_is_preset ON ai_workflows(is_preset);
CREATE INDEX IF NOT EXISTS idx_ai_workflows_is_active ON ai_workflows(is_active);

-- AI 使用统计表
CREATE TABLE IF NOT EXISTS ai_usage_stats (
    id              TEXT PRIMARY KEY,
    date            TEXT NOT NULL,
    provider        TEXT NOT NULL DEFAULT '',
    model           TEXT NOT NULL DEFAULT '',
    request_count   INTEGER DEFAULT 0,
    token_input     INTEGER DEFAULT 0,
    token_output    INTEGER DEFAULT 0,
    tool_call_count INTEGER DEFAULT 0,
    error_count     INTEGER DEFAULT 0,
    avg_latency_ms  INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_stats_date_model ON ai_usage_stats(date, provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_date ON ai_usage_stats(date);

-- ============================================================
-- PARA 分类迁移
-- ============================================================
ALTER TABLE creativities ADD COLUMN para_type TEXT DEFAULT 'resource';
-- 看板项目状态
ALTER TABLE boards ADD COLUMN project_status TEXT DEFAULT 'active';

-- ============================================================
-- 看板自定义图标
-- ============================================================
ALTER TABLE boards ADD COLUMN icon TEXT;

-- ============================================================
-- 聊天室写作模式表
-- ============================================================

-- 聊天室人物
CREATE TABLE IF NOT EXISTS chat_characters (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  speech_style TEXT DEFAULT '',
  color TEXT DEFAULT '#667eea',
  creativity_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_characters_board ON chat_characters(board_id);

-- 人物关系
CREATE TABLE IF NOT EXISTS chat_character_relations (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  character_a_id TEXT NOT NULL,
  character_b_id TEXT NOT NULL,
  relation_type TEXT DEFAULT 'friend',
  description TEXT DEFAULT '',
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_relations_board ON chat_character_relations(board_id);

-- 聊天室消息
CREATE TABLE IF NOT EXISTS chat_room_messages (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  volume_id TEXT NOT NULL,
  chapter_id TEXT,
  type TEXT DEFAULT 'dialogue',
  character_id TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (volume_id) REFERENCES writing_volumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_board ON chat_room_messages(board_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_messages_volume ON chat_room_messages(volume_id);

-- 聊天室场景
CREATE TABLE IF NOT EXISTS chat_scenes (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  volume_id TEXT NOT NULL,
  name TEXT DEFAULT '未命名场景',
  description TEXT DEFAULT '',
  characters TEXT DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
  FOREIGN KEY (volume_id) REFERENCES writing_volumes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_chat_scenes_board ON chat_scenes(board_id);
CREATE INDEX IF NOT EXISTS idx_chat_scenes_volume ON chat_scenes(volume_id);

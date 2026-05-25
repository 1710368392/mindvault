-- ============================================================
-- MindVault Supabase 数据库 Schema
-- 与本地 SQLite schema.sql 保持字段一致，额外添加 user_id
-- 注意：id 使用 TEXT 类型以兼容本地短 ID
-- ============================================================

-- ============================================================
-- 创意表
-- ============================================================
CREATE TABLE IF NOT EXISTS creativities (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL,
    title             TEXT NOT NULL DEFAULT '',
    content           TEXT DEFAULT '',
    type              TEXT DEFAULT 'text' NOT NULL,
    priority          INTEGER DEFAULT 0,
    emoji_reaction    TEXT,
    status            TEXT DEFAULT 'active' NOT NULL,
    template_id       TEXT,
    board_id          TEXT,
    position_x        REAL,
    position_y        REAL,
    card_style        TEXT,
    subtype           TEXT,
    content_format    TEXT DEFAULT 'plain',
    word_count        INTEGER DEFAULT 0,
    is_read           BOOLEAN DEFAULT TRUE,
    is_favorite       BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_reviewed_at  TIMESTAMPTZ
);

-- ============================================================
-- 标签表
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    icon        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ============================================================
-- 创意-标签关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS creativity_tags (
    creativity_id   TEXT NOT NULL,
    tag_id          TEXT NOT NULL,
    PRIMARY KEY (creativity_id, tag_id)
);

-- ============================================================
-- 看板表
-- ============================================================
CREATE TABLE IF NOT EXISTS boards (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    background  TEXT,
    theme       TEXT,
    layout      TEXT DEFAULT 'board' NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS templates (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    description TEXT DEFAULT '',
    category    TEXT,
    config      TEXT DEFAULT '{}',
    is_builtin  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 用户设置表（云端存储用户级设置）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id     TEXT NOT NULL,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);

-- ============================================================
-- 看板-创意关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS board_creativities (
    board_id         TEXT NOT NULL,
    creativity_id    TEXT NOT NULL,
    PRIMARY KEY (board_id, creativity_id)
);

-- ============================================================
-- 画布放置项表
-- ============================================================
CREATE TABLE IF NOT EXISTS board_canvas_items (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    creativity_id   TEXT NOT NULL,
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
    is_favorite     BOOLEAN DEFAULT FALSE,
    content_format  TEXT DEFAULT 'markdown',
    is_linked       BOOLEAN DEFAULT FALSE,
    video_loop_mode INTEGER DEFAULT 0,
    video_frozen_time REAL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 画布连线表
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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 看板便签表
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
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 图谱节点表
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
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 图谱连线表
-- ============================================================
CREATE TABLE IF NOT EXISTS board_graph_edges (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    source_node_id  TEXT NOT NULL,
    target_node_id  TEXT NOT NULL,
    edge_type       TEXT DEFAULT 'child',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 自定义文件夹表
-- ============================================================
CREATE TABLE IF NOT EXISTS board_custom_folders (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    color       TEXT DEFAULT '#6366f1',
    icon        TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 文件夹-创意关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS board_folder_items (
    folder_id      TEXT NOT NULL,
    creativity_id  TEXT NOT NULL,
    PRIMARY KEY (folder_id, creativity_id)
);

-- ============================================================
-- 创意关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS creativity_links (
    id             TEXT PRIMARY KEY,
    source_id      TEXT NOT NULL,
    target_id      TEXT NOT NULL,
    relation_type  TEXT DEFAULT 'related' NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 媒体文件元数据表（仅存元数据，文件本体留在本地）
-- ============================================================
CREATE TABLE IF NOT EXISTS media_metadata (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    creativity_id   TEXT,
    filename        TEXT NOT NULL,
    filepath        TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    file_size       INTEGER NOT NULL,
    width           INTEGER,
    height          INTEGER,
    thumbnail_path  TEXT,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 创意链表
-- ============================================================
CREATE TABLE IF NOT EXISTS creative_chains (
    id          TEXT PRIMARY KEY,
    board_id    TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '未命名创意链',
    description TEXT,
    tags        TEXT,
    color       TEXT,
    snapshot    TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 回收站表
-- ============================================================
CREATE TABLE IF NOT EXISTS trash_items (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    item_type       TEXT NOT NULL,
    item_id         TEXT NOT NULL,
    source_board_id TEXT,
    source_board_name TEXT,
    snapshot        TEXT NOT NULL,
    deleted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_creativities_user_id ON creativities(user_id);
CREATE INDEX IF NOT EXISTS idx_creativities_type ON creativities(type);
CREATE INDEX IF NOT EXISTS idx_creativities_status ON creativities(status);
CREATE INDEX IF NOT EXISTS idx_creativities_created_at ON creativities(created_at);
CREATE INDEX IF NOT EXISTS idx_creativities_updated_at ON creativities(updated_at);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_media_metadata_user_id ON media_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_trash_items_user_id ON trash_items(user_id);

CREATE INDEX IF NOT EXISTS idx_board_canvas_items_board_id ON board_canvas_items(board_id);
CREATE INDEX IF NOT EXISTS idx_board_canvas_edges_board_id ON board_canvas_edges(board_id);
CREATE INDEX IF NOT EXISTS idx_board_sticky_notes_board_id ON board_sticky_notes(board_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_nodes_board_id ON board_graph_nodes(board_id);
CREATE INDEX IF NOT EXISTS idx_board_graph_edges_board_id ON board_graph_edges(board_id);
CREATE INDEX IF NOT EXISTS idx_board_custom_folders_board_id ON board_custom_folders(board_id);
CREATE INDEX IF NOT EXISTS idx_creative_chains_board_id ON creative_chains(board_id);
CREATE INDEX IF NOT EXISTS idx_creativity_links_source_id ON creativity_links(source_id);
CREATE INDEX IF NOT EXISTS idx_creativity_links_target_id ON creativity_links(target_id);

-- ============================================================
-- 新用户注册时自动插入内置模板
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO templates (id, user_id, name, description, category, config, is_builtin, created_at) VALUES
    ('tpl-blank', NEW.id, '空白创意', '从零开始记录你的创意', NULL, '{}', TRUE, NOW()),
    ('tpl-product', NEW.id, '产品灵感', '记录产品相关的创意和想法', '产品', '{"content": "## 产品灵感\n\n### 产品名称\n\n### 目标用户\n\n### 核心功能\n1. \n2. \n3. \n\n### 竞品分析\n- \n\n### 创新点\n- \n\n### 下一步行动\n- [ ] "}', TRUE, NOW()),
    ('tpl-writing', NEW.id, '写作素材', '收集和整理写作相关的素材', '写作', '{"content": "## 写作素材\n\n### 主题\n\n### 灵感来源\n\n### 关键词\n- \n- \n- \n\n### 参考素材\n\n### 大纲\n1. \n2. \n3. \n\n### 初稿\n\n"}', TRUE, NOW()),
    ('tpl-travel', NEW.id, '旅行计划', '规划旅行行程和记录旅途见闻', '旅行', '{"content": "## 旅行计划\n\n### 目的地\n\n### 出行日期\n- **出发**：\n- **返回**：\n\n### 行程安排\n#### Day 1\n- \n\n#### Day 2\n- \n\n### 预算\n| 项目 | 预算 | 实际 |\n|------|------|------|\n| 交通 | | |\n| 住宿 | | |\n| 餐饮 | | |\n| 门票 | | |\n\n### 必备物品\n- [ ] \n\n### 旅途见闻\n\n"}', TRUE, NOW()),
    ('tpl-study', NEW.id, '学习笔记', '记录学习内容和心得体会', '学习', '{"content": "## 学习笔记\n\n### 学科/主题\n\n### 学习目标\n- [ ] \n\n### 核心概念\n1. \n2. \n3. \n\n### 详细笔记\n\n### 重点总结\n\n### 疑问与思考\n\n### 复习计划\n- [ ] \n"}', TRUE, NOW()),
    ('tpl-efficiency', NEW.id, '效率工具', '优化工作流程和提升效率的方法', '效率', '{"content": "## 效率优化\n\n### 当前痛点\n1. \n2. \n\n### 优化目标\n\n### 解决方案\n1. \n2. \n3. \n\n### 工具推荐\n- \n\n### 实施计划\n- [ ] \n\n### 效果评估\n\n"}', TRUE, NOW()),
    ('tpl-reading', NEW.id, '阅读笔记', '记录阅读心得和书籍摘要', '阅读', '{"content": "## 阅读笔记\n\n### 书名\n\n### 作者\n\n### 阅读日期\n\n### 摘要\n\n### 精彩摘录\n> \n\n### 个人感悟\n\n### 行动启发\n- [ ] \n\n### 推荐指数\n⭐⭐⭐⭐⭐\n"}', TRUE, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

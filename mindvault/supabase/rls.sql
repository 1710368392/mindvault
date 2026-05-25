-- ============================================================
-- Row Level Security 策略
-- 核心原则：用户只能访问自己的数据
-- ============================================================

-- 启用 RLS
ALTER TABLE creativities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE creativity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_creativities ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_canvas_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_canvas_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_sticky_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_custom_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_folder_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE creativity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE creative_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE trash_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 直接关联表策略（通过 user_id 隔离）
-- ============================================================

-- creativities
CREATE POLICY "Users can view own creativities" ON creativities FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own creativities" ON creativities FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own creativities" ON creativities FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own creativities" ON creativities FOR DELETE USING (user_id = auth.uid());

-- tags
CREATE POLICY "Users can manage own tags" ON tags FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- boards
CREATE POLICY "Users can manage own boards" ON boards FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- templates
CREATE POLICY "Users can manage own templates" ON templates FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- user_settings
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- media_metadata
CREATE POLICY "Users can manage own media metadata" ON media_metadata FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- trash_items
CREATE POLICY "Users can manage own trash items" ON trash_items FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 间接关联表策略（通过 JOIN 验证 user_id）
-- ============================================================

-- creativity_tags
CREATE POLICY "Users can manage own creativity_tags" ON creativity_tags FOR ALL
USING (EXISTS (SELECT 1 FROM creativities WHERE id = creativity_tags.creativity_id AND user_id = auth.uid()));

-- board_creativities
CREATE POLICY "Users can manage own board_creativities" ON board_creativities FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_creativities.board_id AND user_id = auth.uid()));

-- board_canvas_items
CREATE POLICY "Users can manage own canvas items" ON board_canvas_items FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_canvas_items.board_id AND user_id = auth.uid()));

-- board_canvas_edges
CREATE POLICY "Users can manage own canvas edges" ON board_canvas_edges FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_canvas_edges.board_id AND user_id = auth.uid()));

-- board_sticky_notes
CREATE POLICY "Users can manage own sticky notes" ON board_sticky_notes FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_sticky_notes.board_id AND user_id = auth.uid()));

-- board_graph_nodes
CREATE POLICY "Users can manage own graph nodes" ON board_graph_nodes FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_graph_nodes.board_id AND user_id = auth.uid()));

-- board_graph_edges
CREATE POLICY "Users can manage own graph edges" ON board_graph_edges FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_graph_edges.board_id AND user_id = auth.uid()));

-- board_custom_folders
CREATE POLICY "Users can manage own folders" ON board_custom_folders FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = board_custom_folders.board_id AND user_id = auth.uid()));

-- board_folder_items
CREATE POLICY "Users can manage own folder items" ON board_folder_items FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM board_custom_folders f
        JOIN boards b ON b.id = f.board_id
        WHERE f.id = board_folder_items.folder_id AND b.user_id = auth.uid()
    )
);

-- creativity_links
CREATE POLICY "Users can manage own creativity links" ON creativity_links FOR ALL
USING (EXISTS (SELECT 1 FROM creativities WHERE id = creativity_links.source_id AND user_id = auth.uid()));

-- creative_chains
CREATE POLICY "Users can manage own creative chains" ON creative_chains FOR ALL
USING (EXISTS (SELECT 1 FROM boards WHERE id = creative_chains.board_id AND user_id = auth.uid()));

# 脑洞集 (MindVault) - 后端架构文档

> 本文档由后端工程师专用窗口维护，记录后端技术栈、目录结构、已实现和待实现的API接口。

---

## 1. 技术栈

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| **运行时** | Electron | 33.2.1 | 桌面应用框架，主进程即后端 |
| **语言** | TypeScript | ^5.6.0 | 主进程和渲染进程均使用 |
| **数据库** | SQLite (better-sqlite3) | ^11.0.0 | 主存储，WAL模式 |
| **降级存储** | JSON文件 | - | better-sqlite3不可用时的降级方案 |
| **图片处理** | sharp | ^0.34.5 | 缩略图生成 |
| **PDF导出** | pdfkit | ^0.18.0 | PDF文档生成 |
| **备份压缩** | archiver | ^7.0.1 | ZIP备份打包 |
| **备份解压** | extract-zip | ^2.0.1 | ZIP备份恢复 |
| **构建工具** | Vite | ^6.0.0 | 前端构建 + Electron打包 |
| **打包工具** | electron-builder | ^25.0.0 | Windows NSIS安装包 |

### 通信机制

后端（主进程）与前端（渲染进程）通过 **Electron IPC** 通信：

```
渲染进程 → preload.js (contextBridge) → ipcRenderer.invoke() → 主进程 ipcMain.handle()
```

- `preload.js` 通过 `contextBridge.exposeInMainWorld` 暴露 `window.electronAPI` 命名空间
- 前端通过 `src/renderer/utils/api.ts` 统一封装调用，兼容 Electron 环境和浏览器预览环境（Mock模式）

---

## 2. 后端目录结构

```
mindvault/src/main/                    # 后端根目录（Electron主进程）
├── index.ts                           # 主进程入口 - 已使用模块化架构
│   ├── 窗口创建与管理
│   ├── 数据库初始化（SQLite / JSON降级）
│   ├── 调用 registerAllIpcHandlers 注册所有IPC处理器
│   └── 应用生命周期管理
│
├── preload.js                         # 预加载脚本（暴露electronAPI到渲染进程）
│
├── db/                                # 数据库模块
│   ├── schema.sql                     # SQLite表结构定义（完整的14张表）
│   ├── migration.ts                   # 数据库初始化和迁移
│   └── repository.ts                  # 数据访问层 - 提供 db 和 JsonStore 访问
│
├── ipc/                               # IPC处理器模块
│   ├── index.ts                       # IPC注册入口 - registerAllIpcHandlers
│   ├── creativity.ts                  # 创意CRUD + 关联处理器
│   ├── board.ts                       # 看板管理 + 画布/便签/图谱/文件夹
│   ├── tag.ts                         # 标签管理处理器
│   ├── template.ts                    # 模板管理处理器
│   ├── settings.ts                    # 设置管理处理器
│   ├── media.ts                       # 媒体文件处理器
│   ├── search.ts                      # 搜索处理器
│   ├── backup.ts                      # 备份恢复处理器
│   └── window.ts                      # 窗口控制处理器
│
├── services/                          # 业务服务层
│   ├── ai-recommend.ts                # AI关联推荐服务
│   ├── backup.ts                      # 备份服务（ZIP打包/恢复/自动备份）
│   └── export.ts                      # 导出服务（JSON/PDF/图片）
│
└── utils/                             # 工具函数
    └── index.ts                       # UUID生成、时间格式化、分词、文件处理等
```

### 架构现状说明

✅ **已统一为模块化架构**：
- `index.ts` 使用 `registerAllIpcHandlers` 注册所有处理器
- 所有IPC处理器分离在 `ipc/` 目录
- 数据访问通过 `db/repository.ts` 统一管理
- 支持 SQLite 和 JSON 双模式降级

---

## 3. 数据库表结构

共 **14张表**，完整定义在 `src/main/db/schema.sql`：

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `creativities` | 创意记录（核心表） | id, title, content, type, status, priority, board_id, is_favorite |
| `tags` | 标签 | id, name(UNIQUE), color, icon |
| `creativity_tags` | 创意-标签多对多 | creativity_id, tag_id (联合主键) |
| `boards` | 看板 | id, name, layout(board/canvas/graph/folder) |
| `board_creativities` | 看板-创意多对多 | board_id, creativity_id |
| `board_canvas_items` | 画布放置项 | board_id, creativity_id, position_x, position_y |
| `board_canvas_edges` | 画布连线 | source_item_id, target_item_id, edge_type |
| `board_sticky_notes` | 便签 | board_id, title, content, color, position_x/y |
| `board_graph_nodes` | 图谱节点（树结构） | board_id, creativity_id, parent_id, node_type |
| `board_graph_edges` | 图谱连线 | source_node_id, target_node_id, edge_type |
| `board_custom_folders` | 自定义文件夹 | board_id, name, color, sort_order |
| `board_folder_items` | 文件夹-创意关联 | folder_id, creativity_id |
| `templates` | 模板 | name, category, config, is_builtin |
| `settings` | 键值对设置 | key(PK), value |
| `creativity_links` | 创意关联关系 | source_id, target_id, relation_type |
| `media` | 媒体文件记录 | creativity_id, filename, filepath, mime_type |

### 索引

已创建 **28个索引**，覆盖所有常用查询字段。

### 默认数据

- **7个内置模板**：空白创意、产品灵感、写作素材、旅行计划、学习笔记、效率工具、阅读笔记
- **13项默认设置**：theme, language, fontSize, fontFamily 等

---

## 4. 已实现的API接口

### 4.1 创意管理 (Creativity)

| IPC通道 | 说明 | 参数 | 返回值 |
|---------|------|------|--------|
| `creativity:create` | 创建创意 | data: {title, content, type, priority, tags, ...} | creativity对象 |
| `creativity:list` | 列表查询（分页） | {page, pageSize, status, boardId, type, sortBy, sortOrder} | {data, pagination} |
| `creativity:read` / `creativity:get` | 读取单个 | id | creativity对象或null |
| `creativity:update` | 更新 | id, data | 更新后的对象 |
| `creativity:delete` | 软删除（→trashed） | id | true |
| `creativity:restore` | 从回收站恢复 | id | 恢复后的对象 |
| `creativity:permanent-delete` | 物理删除 | id | true/false |
| `creativity:random` | 随机获取 | - | creativity对象或null |
| `creativity:stats` | 统计数据 | - | {total, today, thisWeek, typeDistribution, ...} |
| `creativity:search` | 关键词搜索（支持筛选） | keyword, filters? | 创意数组 |
| `creativity:batch-update` | 批量更新 | ids[], data | {success, data: {updated_count}} |
| `creativity:batch-delete` | 批量删除（软删除或永久） | ids[], permanent? | {success, data: {deleted_count}} |
| `creativity:toggle-favorite` | 切换收藏 | id | 更新后的对象 |

### 4.2 导出 (Export)

| IPC通道 | 说明 | 参数 | 返回值 |
|---------|------|------|--------|
| `export:json` | 导出JSON | ids? (可选) | JSON字符串 |
| `export:html` | 导出HTML | ids? (可选) | HTML字符串 |
| `export:markdown` | 导出Markdown | ids? (可选) | Markdown字符串 |

### 4.3 看板管理 (Board)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:create` | 创建看板 | {name, description, layout, ...} |
| `board:list` | 列表 | - |
| `board:read` / `board:get` | 读取单个 | id |
| `board:update` | 更新 | id, data |
| `board:delete` | 删除 | id |
| `board:add-creativity` | 添加创意到看板 | boardId, creativityId |
| `board:remove-creativity` | 从看板移除创意 | boardId, creativityId |
| `board:add-creativity-relation` | 添加多对多关联 | boardId, creativityId, relatedId |
| `board:remove-creativity-relation` | 移除多对多关联 | boardId, creativityId, relatedId |
| `board:list-creativities` | 获取看板创意列表 | boardId |
| `creativeChain:list` | 获取创意链列表 | boardId |
| `creativeChain:create` | 创建创意链 | boardId, {name, description, tags, snapshot} |
| `creativeChain:read` | 读取创意链 | boardId, chainId |
| `creativeChain:update` | 更新创意链 | boardId, chainId, data |
| `creativeChain:delete` | 删除创意链 | boardId, chainId |

### 4.2 创意关联 (Link)

| IPC通道 | 说明 | 参数 | 返回值 |
|---------|------|------|--------|
| `link:add` / `link:create` | 添加关联 | sourceId, targetId, relationType | {success, data} |
| `link:remove` / `link:delete` | 移除关联 | sourceId, targetId | {success} |
| `link:list` | 获取关联列表 | creativityId | {success, data} |

### 4.3 看板管理 (Board)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:create` | 创建看板 | {name, description, layout, ...} |
| `board:list` | 列表 | - |
| `board:read` / `board:get` | 读取单个 | id |
| `board:update` | 更新 | id, data |
| `board:delete` | 删除 | id |
| `board:add-creativity` | 添加创意到看板 | boardId, creativityId |
| `board:remove-creativity` | 从看板移除创意 | boardId, creativityId |
| `board:add-creativity-relation` | 添加多对多关联 | boardId, creativityId, relatedId |
| `board:remove-creativity-relation` | 移除多对多关联 | boardId, creativityId, relatedId |
| `board:list-creativities` | 获取看板创意列表 | boardId |

### 4.4 画布视图 (Canvas)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:canvas-items` | 获取画布项 | boardId |
| `board:canvas-item-create` | 添加画布项 | boardId, {creativityId, positionX, positionY, ...} |
| `board:canvas-item-update` | 更新画布项 | boardId, itemId, data |
| `board:canvas-item-delete` | 删除画布项 | boardId, itemId |
| `board:canvas-update-position` | 更新位置 | itemId, x, y |
| `board:canvas-edges` | 获取连线 | boardId |
| `board:canvas-edge-create` | 添加连线 | boardId, {sourceItemId, targetItemId, ...} |
| `board:canvas-edge-delete` | 删除连线 | boardId, edgeId |

### 4.5 便签 (Sticky Notes)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:sticky-notes` | 获取便签列表 | boardId |
| `board:sticky-note-create` | 添加便签 | boardId, {title, content, color, ...} |
| `board:sticky-note-update` | 更新便签 | boardId, noteId, data |
| `board:sticky-note-delete` | 删除便签 | boardId, noteId |

### 4.6 图谱视图 (Graph)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:graph-nodes` | 获取节点 | boardId |
| `board:graph-node-create` | 添加节点 | boardId, {creativityId, parentId, ...} |
| `board:graph-node-update` | 更新节点 | boardId, nodeId, data |
| `board:graph-node-delete` | 删除节点（级联清理） | boardId, nodeId |
| `board:graph-edges` | 获取连线 | boardId |
| `board:graph-edge-create` | 添加连线 | boardId, {sourceNodeId, targetNodeId, ...} |
| `board:graph-edge-delete` | 删除连线 | boardId, edgeId |
| `board:graph-get-subtree` | 获取子树 | nodeId |
| `board:graph-update-position` | 更新节点位置 | nodeId, x, y |

### 4.7 文件夹 (Folder)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `board:folders` | 获取文件夹列表 | boardId |
| `board:folder-create` | 创建文件夹 | boardId, {name, color, ...} |
| `board:folder-update` | 更新文件夹 | boardId, folderId, data |
| `board:folder-delete` | 删除文件夹 | boardId, folderId |
| `board:folder-add-item` | 添加创意到文件夹 | boardId, folderId, creativityId |
| `board:folder-remove-item` | 从文件夹移除创意 | boardId, folderId, creativityId |
| `board:folder-items` | 获取文件夹创意 | boardId, folderId |

### 4.8 标签管理 (Tag)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `tag:create` | 创建标签 | {name, color, icon} |
| `tag:list` | 列表 | - |
| `tag:read` / `tag:get` | 读取单个 | id |
| `tag:update` | 更新 | id, data |
| `tag:delete` | 删除 | id |
| `tag:assign` | 分配标签 | creativityId, tagId |
| `tag:unassign` | 取消标签 | creativityId, tagId |

### 4.9 模板 (Template)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `template:list` | 列表 | - |
| `template:get` | 读取单个 | id |
| `template:create` | 创建 | {name, description, category, config, ...} |
| `template:update` | 更新 | id, data |
| `template:delete` | 删除（禁止删除内置） | id |

### 4.10 设置 (Settings)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `settings:get` | 获取设置 | key |
| `settings:set` | 设置值 | key, value |

### 4.11 媒体 (Media)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `media:save` | 保存媒体 | data |
| `media:read` / `media:get` | 读取媒体 | id |
| `media:delete` | 删除媒体 | id |
| `media:thumbnail` | 获取缩略图 | id, size? |

### 4.12 搜索 (Search)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `search:fulltext` | 全文搜索 | keyword |
| `search:filter` | 高级筛选 | {types, priorityMin/Max, boardId} |

### 4.13 导出 (Export)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `export:json` | 导出JSON | ids? |
| `export:html` | 导出HTML | ids? |
| `export:markdown` | 导出Markdown | ids? |

### 4.14 备份 (Backup)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `backup:create` | 创建备份 | - |
| `backup:restore` | 恢复备份 | filePath |

### 4.15 窗口控制 (Window)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `window:minimize` | 最小化 | - |
| `window:maximize` | 最大化/还原 | - |
| `window:close` | 关闭 | - |

### 4.16 文件对话框 (File)

| IPC通道 | 说明 | 参数 |
|---------|------|------|
| `file:select` | 文件选择 | filters |
| `file:save` | 文件保存 | defaultPath, filters |

---

## 5. 待实现的API接口

以下是在 `ipc-channels.ts` 中已定义通道名称，但**尚未实现**或**实现不完整**的接口：

| IPC通道 | 说明 | 优先级 | 备注 |
|---------|------|--------|------|
| `creativity:count` | 创意计数 | 🟡 中 | 统计面板优化 |
| `settings:save` | 批量保存设置 | 🟡 中 | 与 settings:set 功能重叠，需统一 |
| `settings:reset` | 重置为默认设置 | 🟡 中 | 设置页面需要 |
| `import:json` | 从JSON导入数据 | 🔴 高 | 与导出功能配套 |
| `backup:list` | 列出备份文件 | 🟡 中 | 备份管理页面需要 |
| `file:open` | 打开文件 | 🟢 低 | 可用 file:select 替代 |
| `file:select-folder` | 选择文件夹 | 🟢 低 | 部分导入场景需要 |
| `app:get-version` | 获取应用版本 | 🟢 低 | 关于页面需要 |
| `app:get-path` | 获取应用路径 | 🟢 低 | 调试用 |

### 已修复的接口

- ✅ `creativity:restore` - 已实现（从回收站恢复创意）
- ✅ `export:html`, `export:markdown` - 已实现
- ✅ `backup:auto` - 已修复，统一单位为分钟
- ✅ `creativeChain:*` - 已实现创意链管理
- ✅ `creativity:search` - 已增强，支持完整的 filters 参数
- ✅ `creativity:batch-delete` - 已新增，支持批量删除（软删除/永久）
- ✅ `T-030` - 备份包含媒体文件功能已实现（备份包含整个 data 目录）

### 注意事项

- `link:*` 通道：在 `creativity.ts` 中已实现为 `link:add`, `link:remove`, `link:list`
- 部分通道有别名（如 `creativity:read` 和 `creativity:get`），实现时需兼容

---

## 6. 已知问题与技术债

### 🟡 中等问题

1. **模板表结构 vs 代码不一致**：schema.sql 的 templates 表有 `config` 字段，但代码中的模板数据使用不同的结构
2. **搜索仅使用 LIKE 模糊匹配**：未使用 SQLite FTS5 全文搜索，性能有限
3. **部分 IPC 通道名称不一致**：有些用冒号分隔，有些用连字符

### 🟢 轻微问题

4. **camelCase/snake_case 转换不统一**：部分 IPC 返回 snake_case，部分返回 camelCase
5. **ID 生成策略不一致**：repository.ts 用 `Date.now().toString(36) + random`，utils 用 `crypto.randomUUID()`
6. **错误处理不统一**：部分处理器返回 null/false，部分返回 `{success, error}` 结构

---

## 7. 后续开发规范

### 新增 API 接口流程

1. 在 `src/shared/ipc-channels.ts` 添加通道常量（可选，用于类型安全）
2. 在 `src/main/ipc/` 对应模块中添加处理器
3. 在 `src/main/preload.js` 的 `electronAPI` 中暴露方法
4. 在 `src/renderer/utils/api.ts` 中封装前端调用（含 Mock）
5. 更新本文档

### 数据库变更流程

1. 在 `src/main/db/schema.sql` 添加/修改表结构
2. 如需数据迁移，在 `migration.ts` 中添加迁移逻辑
3. 更新本文档的表结构说明

---

*最后更新：2026-04-21*

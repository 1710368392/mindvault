# 脑洞集 (MindVault) - API 接口文档

> 文档工程师专用窗口维护 | 最后更新: 2026-04-21
> 本文档是前后端对接的唯一标准，所有接口基于实际代码实现。

---

## 概述

脑洞集是 Electron 桌面应用，前后端通过 IPC（Inter-Process Communication）通信。渲染进程通过 `window.electronAPI` 调用主进程暴露的接口，采用 `ipcMain.handle` / `ipcRenderer.invoke` 模式（异步 Promise）。

---

## 接口总览

| 模块 | 接口数量 | 说明 |
|------|----------|------|
| 创意管理 | 14 | 创意的 CRUD、搜索、统计、收藏、批量操作、关联管理 |
| 看板管理 | 24 | 看板的 CRUD、画布、便签、图谱、文件夹 |
| 标签管理 | 5 | 标签的 CRUD 及查询关联创意 |
| 模板管理 | 5 | 模板的 CRUD |
| 设置管理 | 2 | 获取与保存设置 |
| 搜索 | 4 | 全文搜索、高级筛选、搜索历史 |
| 媒体文件 | 4 | 媒体的保存、读取、删除、缩略图 |
| 备份恢复 | 6 | 创建备份、恢复、列表、删除、导入导出 |
| 窗口控制 | 8 | 最小化、最大化、关闭、编辑器窗口管理 |

---

## 一、创意管理

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 创建创意 | POST | `creativity:create` | data: CreativityCreateInput | Creativity | 创建新创意 |
| 获取创意列表 | GET | `creativity:list` | params?: CreativityListParams | { data: Creativity[], pagination: Pagination } | 分页获取创意列表 |
| 读取单个创意 | GET | `creativity:read` | id: string | Creativity \| null | 根据ID读取创意 |
| 更新创意 | PUT | `creativity:update` | id: string, data: Partial<Creativity> | Creativity \| null | 更新创意信息 |
| 删除创意（软删除） | DELETE | `creativity:delete` | id: string | boolean | 将创意状态设为 trashed |
| 永久删除创意 | DELETE | `creativity:permanent-delete` | id: string | boolean | 物理删除创意及其关联标签 |
| 获取随机创意 | GET | `creativity:random` | 无 | Creativity \| null | 从 active 状态中随机获取一条创意 |
| 获取创意统计 | GET | `creativity:stats` | 无 | CreativityStats | 获取各类统计数据 |
| 搜索创意 | GET | `creativity:search` | keyword: string | Creativity[] | 在标题和内容中模糊匹配，限50条 |
| 切换收藏状态 | POST | `creativity:toggle-favorite` | id: string | Creativity \| null | 切换创意的收藏状态 |
| 批量更新创意 | PUT | `creativity:batch-update` | ids: string[], data: Partial<Creativity> | { success: boolean, data?: { updated_count: number } } | 批量更新多条创意 |
| 添加创意关联 | POST | `link:add` | sourceId: string, targetId: string, relationType?: string | { success: boolean, data?: Link, error?: string } | 创建两个创意之间的关联 |
| 移除创意关联 | DELETE | `link:remove` | sourceId: string, targetId: string | { success: boolean, error?: string } | 删除创意关联 |
| 获取创意关联列表 | GET | `link:list` | creativityId: string | { success: boolean, data?: Link[], error?: string } | 获取与该创意相关的所有关联 |

---

## 二、看板管理

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 创建看板 | POST | `board:create` | data: BoardCreateInput | Board | 创建新看板 |
| 获取看板列表 | GET | `board:list` | 无 | Board[] | 获取所有看板，按 sort_order 排序 |
| 读取单个看板 | GET | `board:read` | id: string | Board \| null | 根据ID读取看板 |
| 更新看板 | PUT | `board:update` | id: string, data: Partial<Board> | Board \| null | 更新看板信息 |
| 删除看板 | DELETE | `board:delete` | id: string | boolean | 删除看板 |
| 向看板添加创意 | POST | `board:add-creativity` | boardId: string, creativityId: string | boolean | 将创意添加到看板（通过关联表） |
| 从看板移除创意 | DELETE | `board:remove-creativity` | boardId: string, creativityId: string | boolean | 从看板移除创意 |
| 获取看板创意列表 | GET | `board:list-creativities` | boardId: string | Creativity[] | 获取看板下的所有创意 |
| 添加创意关联 | POST | `board:add-creativity-relation` | boardId: string, creativityId: string, relatedId: string | boolean | 将两个创意都添加到看板 |
| 移除创意关联 | DELETE | `board:remove-creativity-relation` | boardId: string, creativityId: string, relatedId: string | boolean | 占位实现 |

### 看板画布

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取画布项列表 | GET | `board:canvas-items` | boardId: string | BoardCanvasItem[] | 获取看板画布的所有项 |
| 创建画布项 | POST | `board:canvas-item-create` | boardId: string, data: CanvasItemCreateInput | BoardCanvasItem \| null | 创建新的画布项 |
| 更新画布项 | PUT | `board:canvas-item-update` | boardId: string, itemId: string, data: Partial<BoardCanvasItem> | BoardCanvasItem \| null | 更新画布项 |
| 删除画布项 | DELETE | `board:canvas-item-delete` | boardId: string, itemId: string | boolean | 删除画布项 |
| 更新画布项位置 | PUT | `board:canvas-update-position` | itemId: string, x: number, y: number | boolean | 更新画布项坐标 |
| 获取画布连线列表 | GET | `board:canvas-edges` | boardId: string | BoardCanvasEdge[] | 获取所有画布连线 |
| 创建画布连线 | POST | `board:canvas-edge-create` | boardId: string, data: CanvasEdgeCreateInput | BoardCanvasEdge \| null | 创建新连线 |
| 删除画布连线 | DELETE | `board:canvas-edge-delete` | boardId: string, edgeId: string | boolean | 删除连线 |

### 看板便签

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取便签列表 | GET | `board:sticky-notes` | boardId: string | BoardStickyNote[] | 获取所有便签 |
| 创建便签 | POST | `board:sticky-note-create` | boardId: string, data: StickyNoteCreateInput | BoardStickyNote \| null | 创建新便签 |
| 更新便签 | PUT | `board:sticky-note-update` | boardId: string, noteId: string, data: Partial<BoardStickyNote> | BoardStickyNote \| null | 更新便签 |
| 删除便签 | DELETE | `board:sticky-note-delete` | boardId: string, noteId: string | boolean | 删除便签 |

### 看板图谱

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取图谱节点列表 | GET | `board:graph-nodes` | boardId: string | BoardGraphNode[] | 获取所有图谱节点 |
| 创建图谱节点 | POST | `board:graph-node-create` | boardId: string, data: GraphNodeCreateInput | BoardGraphNode \| null | 创建新节点 |
| 更新图谱节点 | PUT | `board:graph-node-update` | boardId: string, nodeId: string, data: Partial<BoardGraphNode> | BoardGraphNode \| null | 更新节点 |
| 删除图谱节点 | DELETE | `board:graph-node-delete` | boardId: string, nodeId: string | boolean | 删除节点 |
| 更新图谱节点位置 | PUT | `board:graph-update-position` | nodeId: string, x: number, y: number | boolean | 更新节点坐标 |
| 获取图谱连线列表 | GET | `board:graph-edges` | boardId: string | BoardGraphEdge[] | 获取所有图谱连线 |
| 创建图谱连线 | POST | `board:graph-edge-create` | boardId: string, data: GraphEdgeCreateInput | BoardGraphEdge \| null | 创建新连线 |
| 删除图谱连线 | DELETE | `board:graph-edge-delete` | boardId: string, edgeId: string | boolean | 删除连线 |
| 获取图谱子树 | GET | `board:graph-get-subtree` | nodeId: string | BoardGraphNode[] | 递归获取节点的子树 |

### 看板文件夹

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取文件夹列表 | GET | `board:folders` | boardId: string | BoardCustomFolder[] | 获取所有文件夹 |
| 创建文件夹 | POST | `board:folder-create` | boardId: string, data: FolderCreateInput | BoardCustomFolder \| null | 创建新文件夹 |
| 更新文件夹 | PUT | `board:folder-update` | boardId: string, folderId: string, data: Partial<BoardCustomFolder> | BoardCustomFolder \| null | 更新文件夹 |
| 删除文件夹 | DELETE | `board:folder-delete` | boardId: string, folderId: string | boolean | 删除文件夹及其关联项 |
| 获取文件夹内创意 | GET | `board:folder-items` | boardId: string, folderId: string | Creativity[] | 获取文件夹内的创意 |
| 向文件夹添加创意 | POST | `board:folder-add-item` | boardId: string, folderId: string, creativityId: string | boolean | 添加创意到文件夹 |
| 从文件夹移除创意 | DELETE | `board:folder-remove-item` | boardId: string, folderId: string, creativityId: string | boolean | 从文件夹移除创意 |

---

## 三、标签管理

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 创建标签 | POST | `tag:create` | data: TagCreateInput | Tag \| null | 创建新标签 |
| 获取标签列表 | GET | `tag:list` | 无 | Tag[] | 获取所有标签，按 name 排序 |
| 更新标签 | PUT | `tag:update` | id: string, data: Partial<Tag> | Tag \| null | 更新标签信息 |
| 删除标签 | DELETE | `tag:delete` | id: string | boolean | 删除标签及其关联 |
| 获取标签关联创意 | GET | `tag:creativities` | tagId: string | Creativity[] | 获取该标签下的所有 active 创意 |

---

## 四、模板管理

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取模板列表 | GET | `template:list` | params?: { category?: string } | Template[] | 获取模板列表，可选按分类筛选 |
| 创建模板 | POST | `template:create` | data: TemplateCreateInput | Template \| null | 创建新模板 |
| 读取单个模板 | GET | `template:read` | id: string | Template \| null | 根据ID读取模板 |
| 更新模板 | PUT | `template:update` | id: string, data: Partial<Template> | Template \| null | 更新模板 |
| 删除模板 | DELETE | `template:delete` | id: string | boolean | 删除模板（系统内置模板不可删除） |

---

## 五、设置管理

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取设置 | GET | `settings:get` | key: string | any \| null | 获取指定键的设置值 |
| 保存设置 | POST | `settings:set` | key: string, value: any | boolean | 保存设置值 |
| 获取所有设置 | GET | `settings:get-all` | 无 | { [key: string]: any } | 获取所有设置 |

---

## 六、搜索

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 搜索创意 | GET | `search:creativities` | params?: SearchParams | { data: Creativity[], pagination: Pagination } | 高级筛选搜索 |
| 获取搜索建议 | GET | `search:suggestions` | keyword: string | { title: string, content: string }[] | 获取搜索建议 |
| 获取最近搜索词 | GET | `search:recent-keywords` | 无 | string[] | 获取最近搜索关键词 |
| 添加最近搜索词 | POST | `search:add-recent-keyword` | keyword: string | boolean | 添加搜索词到历史 |
| 清除最近搜索词 | DELETE | `search:clear-recent-keywords` | 无 | boolean | 清空搜索历史 |

---

## 七、媒体文件

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 获取媒体列表 | GET | `media:list` | 无 | Media[] | 获取所有媒体文件 |
| 保存图片 | POST | `media:save-image` | imageDataUrl: string | { success: boolean, data?: Media, error?: string } | 保存 base64 图片 |
| 读取文件 | GET | `media:read-file` | filePath: string | string \| null | 读取文件为 base64（仅图片） |
| 删除媒体 | DELETE | `media:delete` | mediaId: string | { success: boolean, error?: string } | 删除媒体文件 |
| 选择并保存文件 | POST | `media:select-file` | options?: any | { success: boolean, data?: Media, canceled?: boolean, error?: string } | 弹出文件选择框并保存 |
| 获取缩略图 | GET | `media:get-thumbnail` | filePath: string, width?: number, height?: number | string \| null | 获取缩略图 base64 |

---

## 八、备份恢复

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 创建备份 | POST | `backup:create` | 无 | { success: boolean, data?: Backup, error?: string } | 创建 ZIP 备份 |
| 获取备份列表 | GET | `backup:list` | 无 | Backup[] | 获取所有备份 |
| 恢复备份 | POST | `backup:restore` | backupId: string | { success: boolean, message?: string, error?: string } | 从备份恢复数据 |
| 导出数据 | POST | `backup:export-to-file` | format?: 'json' \| 'csv' | { success: boolean, message?: string, canceled?: boolean, error?: string } | 导出数据到文件 |
| 导入数据 | POST | `backup:import-from-file` | 无 | { success: boolean, data?: { imported_count: number }, message?: string, canceled?: boolean, error?: string } | 从文件导入数据 |
| 删除备份 | DELETE | `backup:delete` | backupId: string | { success: boolean, error?: string } | 删除备份文件 |
| 自动备份配置 | POST | `backup:auto` | config?: AutoBackupConfig | { success: boolean, data?: AutoBackupConfig, error?: string } | 设置或获取自动备份配置 |

---

## 九、窗口控制

| 接口名称 | 请求方式 | IPC 通道 | 请求参数 | 返回数据 | 说明 |
|---------|---------|---------|---------|---------|------|
| 最小化窗口 | POST | `window:minimize` | 无 | void | 最小化主窗口 |
| 最大化窗口 | POST | `window:maximize` | 无 | void | 最大化或还原主窗口 |
| 关闭窗口 | POST | `window:close` | 无 | void | 关闭主窗口 |
| 打开编辑器窗口 | POST | `window:open-editor` | options?: { creativityId?: string, initialContent?: string } | { success: boolean, windowId: number } | 打开新的编辑器窗口 |
| 关闭编辑器窗口 | DELETE | `window:close-editor` | windowId: number | { success: boolean, error?: string } | 关闭编辑器窗口 |
| 获取所有编辑器窗口 | GET | `window:get-all-editors` | 无 | { windowId: number, creativityId: string, isFocused: boolean }[] | 获取所有编辑器窗口信息 |
| 聚焦编辑器窗口 | POST | `window:focus-editor` | windowId: number | { success: boolean, error?: string } | 聚焦指定编辑器窗口 |
| 设置窗口标题 | POST | `window:set-title` | title: string | void | 设置主窗口标题 |
| 获取窗口边界 | GET | `window:get-bounds` | 无 | Rectangle \| null | 获取窗口位置和大小 |
| 设置窗口边界 | POST | `window:set-bounds` | bounds: Rectangle | void | 设置窗口位置和大小 |
| 是否最大化 | GET | `window:is-maximized` | 无 | boolean | 判断窗口是否最大化 |
| 切换全屏 | POST | `window:toggle-fullscreen` | 无 | void | 切换全屏状态 |

---

## 附录 A：核心数据模型

### Creativity（创意）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| title | string | 标题 |
| content | string | 内容 |
| type | string | 类型：text / image / audio / link / video |
| subtype | string | 写作子类型 |
| contentFormat | string | 格式：plain / markdown |
| wordCount | number | 字数 |
| priority | number | 优先级 0-5 |
| emojiReaction | string \| null | Emoji 反应 |
| status | string | 状态：active / archived / trashed |
| templateId | string \| null | 模板 ID |
| boardId | string \| null | 看板 ID |
| positionX | number \| null | X 坐标 |
| positionY | number \| null | Y 坐标 |
| cardStyle | string \| null | 卡片样式 JSON |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |
| lastReviewedAt | string \| null | 最后审阅时间 |
| isRead | boolean | 是否已读 |
| isFavorite | boolean | 是否收藏 |
| tags | Tag[] | 关联标签 |

### Board（看板）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 名称 |
| description | string \| null | 描述 |
| background | string \| null | 背景 |
| theme | string \| null | 主题 |
| layout | string | 布局：board / canvas / graph / folder |
| sortOrder | number | 排序 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### Tag（标签）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 名称 |
| color | string \| null | 颜色 |
| icon | string \| null | 图标 |
| createdAt | string | 创建时间 |

### Template（模板）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 名称 |
| category | string | 分类 |
| config | string | 配置 JSON |
| isBuiltin | boolean | 是否系统内置 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

---

## 附录 B：常见参数类型

### Pagination

```typescript
{
  page: number;
  pageSize: number;
  total: number;
}
```

### CreativityCreateInput

```typescript
{
  title?: string;
  content?: string;
  type?: string;
  priority?: number;
  emojiReaction?: string | null;
  templateId?: string | null;
  boardId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  cardStyle?: string | null;
  tags?: string[];
}
```

### CreativityListParams

```typescript
{
  page?: number;
  pageSize?: number;
  status?: string;
  boardId?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
}
```

### SearchParams

```typescript
{
  keyword?: string;
  type?: string;
  tagId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}
```

---

## 附录 C：注意事项

1. **数据库命名**：数据库字段使用 `snake_case`，前端使用 `camelCase`，部分接口返回数据已做转换。
2. **软删除机制**：`creativity:delete` 仅将 status 设为 `trashed`，永久删除需调用 `creativity:permanent-delete`。
3. **备份恢复**：备份恢复操作会清空现有数据，不可撤销。
4. **兼容性**：当数据库不可用时，系统会降级为 JSON 文件存储模式。

---

## 变更记录

| 日期 | 变更内容 | 操作人 |
|------|----------|--------|
| 2026-04-21 | 重写 API 文档，基于实际代码实现整理所有 72 个接口 | 文档工程师 |

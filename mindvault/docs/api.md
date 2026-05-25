# 脑洞集后端API接口文档

## 技术栈
- **主语言**: TypeScript
- **运行环境**: Electron
- **数据库**: SQLite (better-sqlite3)
- **备用存储**: JSON文件

## API接口列表

### 1. 创意相关接口

#### 1.1 基础操作
- `creativity:create` - 创建新创意
- `creativity:list` - 获取创意列表（支持分页、筛选、排序）
- `creativity:read` - 获取单个创意详情
- `creativity:update` - 更新创意
- `creativity:delete` - 删除创意（移至回收站）
- `creativity:permanent-delete` - 永久删除创意
- `creativity:random` - 随机获取一个创意
- `creativity:stats` - 获取创意统计数据
- `creativity:search` - 搜索创意
- `creativity:toggle-favorite` - 切换创意收藏状态
- `creativity:batch-update` - 批量更新创意

#### 1.2 关联功能（新增）
- `link:add` - 添加创意关联
- `link:remove` - 移除创意关联
- `link:list` - 获取创意关联列表

### 2. 备份相关接口

- `backup:create` - 创建备份
- `backup:list` - 获取备份列表
- `backup:restore` - 恢复备份
- `backup:export-to-file` - 导出数据到文件
- `backup:import-from-file` - 从文件导入数据
- `backup:delete` - 删除备份
- `backup:auto` - 自动备份配置（新增）

### 3. 看板相关接口

- `board:create` - 创建看板
- `board:list` - 获取看板列表
- `board:update` - 更新看板
- `board:delete` - 删除看板
- `board:creativity:add` - 向看板添加创意
- `board:creativity:remove` - 从看板移除创意
- `board:creativity:list` - 获取看板中的创意列表

### 4. 画布相关接口

- `board:canvas:item:create` - 创建画布项
- `board:canvas:item:update` - 更新画布项
- `board:canvas:item:delete` - 删除画布项
- `board:canvas:item:list` - 获取画布项列表
- `board:canvas:edge:create` - 创建画布边
- `board:canvas:edge:update` - 更新画布边
- `board:canvas:edge:delete` - 删除画布边
- `board:canvas:edge:list` - 获取画布边列表

### 5. 便签相关接口

- `board:sticky:create` - 创建便签
- `board:sticky:update` - 更新便签
- `board:sticky:delete` - 删除便签
- `board:sticky:list` - 获取便签列表

### 6. 图谱相关接口

- `board:graph:node:create` - 创建图谱节点
- `board:graph:node:update` - 更新图谱节点
- `board:graph:node:delete` - 删除图谱节点
- `board:graph:node:list` - 获取图谱节点列表
- `board:graph:edge:create` - 创建图谱边
- `board:graph:edge:update` - 更新图谱边
- `board:graph:edge:delete` - 删除图谱边
- `board:graph:edge:list` - 获取图谱边列表

### 7. 文件夹相关接口

- `board:folder:create` - 创建自定义文件夹
- `board:folder:update` - 更新自定义文件夹
- `board:folder:delete` - 删除自定义文件夹
- `board:folder:list` - 获取自定义文件夹列表
- `board:folder:item:add` - 向文件夹添加创意
- `board:folder:item:remove` - 从文件夹移除创意
- `board:folder:item:list` - 获取文件夹中的创意列表

### 8. 标签相关接口

- `tag:create` - 创建标签
- `tag:list` - 获取标签列表
- `tag:update` - 更新标签
- `tag:delete` - 删除标签
- `tag:creativity:add` - 为创意添加标签
- `tag:creativity:remove` - 从创意移除标签
- `tag:creativity:list` - 获取创意的标签列表

### 9. 模板相关接口

- `template:create` - 创建模板
- `template:list` - 获取模板列表
- `template:update` - 更新模板
- `template:delete` - 删除模板

### 10. 设置相关接口

- `settings:get` - 获取设置
- `settings:set` - 设置配置

### 11. 媒体相关接口

- `media:upload` - 上传媒体文件
- `media:list` - 获取媒体文件列表
- `media:delete` - 删除媒体文件

### 12. 搜索相关接口

- `search:creativity` - 搜索创意
- `search:board` - 搜索看板

### 13. 导出相关接口

- `export:creativity` - 导出创意
- `export:board` - 导出看板

### 14. 窗口相关接口

- `window:minimize` - 最小化窗口
- `window:maximize` - 最大化窗口
- `window:close` - 关闭窗口
- `window:fullscreen` - 切换全屏

### 15. 文件对话框相关接口

- `dialog:open-file` - 打开文件对话框
- `dialog:save-file` - 保存文件对话框

## 新增接口详情

### 1. 创意关联接口

#### `link:add`
- **功能**: 添加创意关联
- **参数**: 
  - `sourceId`: 源创意ID
  - `targetId`: 目标创意ID
  - `relationType`: 关联类型（默认: 'related'）
- **返回**: `{ success: boolean, data?: object, error?: string }`

#### `link:remove`
- **功能**: 移除创意关联
- **参数**: 
  - `sourceId`: 源创意ID
  - `targetId`: 目标创意ID
- **返回**: `{ success: boolean, error?: string }`

#### `link:list`
- **功能**: 获取创意关联列表
- **参数**: 
  - `creativityId`: 创意ID
- **返回**: `{ success: boolean, data?: array, error?: string }`

### 2. 自动备份接口

#### `backup:auto`
- **功能**: 设置或获取自动备份配置
- **参数**: 
  - `config` (可选): 自动备份配置对象
    - `enabled`: 是否启用
    - `interval_hours`: 备份间隔（小时）
    - `max_count`: 最大备份数量
- **返回**: `{ success: boolean, data?: object, error?: string }`

## 数据库表结构

### 核心表
- `creativities` - 创意表
- `boards` - 看板表
- `tags` - 标签表
- `templates` - 模板表
- `settings` - 设置表
- `backups` - 备份记录表

### 关联表
- `creativity_tags` - 创意标签关联
- `board_creativities` - 看板创意关联
- `board_canvas_items` - 看板画布项
- `board_canvas_edges` - 看板画布边
- `board_sticky_notes` - 看板便签
- `board_graph_nodes` - 看板图谱节点
- `board_graph_edges` - 看板图谱边
- `board_custom_folders` - 看板自定义文件夹
- `board_folder_items` - 看板文件夹项
- `creativity_links` - 创意关联表（新增）
- `media` - 媒体文件表（新增）

## 错误处理

所有API接口返回格式统一为：

```json
{
  "success": boolean,
  "data"?: any,        // 成功时返回的数据
  "error"?: string,    // 失败时的错误信息
  "message"?: string   // 额外的提示信息
}
```

## 最佳实践

1. **错误处理**: 调用API时应检查返回的`success`字段
2. **参数验证**: 客户端应在调用前验证参数的有效性
3. **性能优化**: 对于大量数据操作，建议使用批量接口
4. **数据安全**: 敏感操作应进行用户确认
5. **离线支持**: 应用应处理网络中断等异常情况

## 版本历史

- **v1.0.0**
  - 初始版本
  - 实现基础创意管理功能
  - 支持SQLite和JSON存储
  
- **v1.1.0**
  - 新增创意关联功能
  - 新增媒体文件支持
  - 新增自动备份配置
  - 优化数据库结构
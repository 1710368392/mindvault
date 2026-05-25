# 修复回收站删除后本地文件未清理

## 问题根因

回收站永久删除时，存在多处遗漏媒体文件清理的问题：

| 删除方式 | 是否清理媒体文件 | 问题 |
|---|---|---|
| `creativity:permanent-delete` (单个) | ✅ 是 | 唯一正确的路径 |
| `creativity:batch-delete` (批量永久) | ❌ 否 | 只删了 creativity_tags + creativities，遗漏 media 表和磁盘文件 |
| `trash:permanent-delete` | ❌ 否 | 仅删 trash_items 记录 |
| `trash:clear` | ❌ 否 | 仅清空 trash_items 表 |

前端 `Trash.tsx` 中的 `handlePermanentDelete` 对 creativity 类型会调用 `creativity:permanent-delete`（正确），但对非 creativity 类型（如 folder、canvas-item 等）只调用 `trash:permanent-delete`，不清理关联的创意和媒体文件。

## 修复方案

### 步骤1：修复 `trash:permanent-delete` — 删除时同步清理关联创意和媒体

在 `src/main/ipc/trash.ts` 的 `trash:permanent-delete` handler 中，删除 trash_items 记录之前，先查找关联的创意并清理其媒体文件：

1. 查找 trash_item 对应的 itemId 和 itemType
2. 如果 itemType 是 creativity，调用已有的媒体清理逻辑（查询 media 表 → 删除磁盘文件 → 删除 media 记录 → 删除 creativity_tags → 删除 creativity 记录）
3. 最后删除 trash_items 记录

### 步骤2：修复 `trash:clear` — 清空时同步清理所有关联创意和媒体

在 `src/main/ipc/trash.ts` 的 `trash:clear` handler 中，清空 trash_items 表之前，遍历所有 trash_items，对每个 creativity 类型的项执行媒体清理逻辑。

### 步骤3：修复 `creativity:batch-delete` — 批量永久删除时清理媒体

在 `src/main/ipc/creativity.ts` 的 `creativity:batch-delete` handler 中，permanent 模式下增加：
1. 查询每个创意关联的 media 记录
2. 删除磁盘文件（filepath + thumbnail_path）
3. 删除 media 表记录
4. 再删除 creativity_tags 和 creativities

### 步骤4：提取公共的媒体清理函数

将 `creativity:permanent-delete` 中已有的媒体清理逻辑提取为独立函数 `deleteCreativityMedia(db, creativityId)`，供以上三处复用，避免代码重复。

## 涉及文件

- `src/main/ipc/trash.ts` — 修改 `trash:permanent-delete` 和 `trash:clear`
- `src/main/ipc/creativity.ts` — 修改 `creativity:batch-delete`，提取公共函数

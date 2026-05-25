# 隐藏 media:// 引用，分离媒体关联与用户内容

## 问题分析

用户在新建创意时添加多媒体文件后，内容编辑器中会出现 `media://mog1c8s3a0r0vbt3d` 这样的字符串。这带来三个问题：

1. **可见性差**：`media://` 是内部引用标识，不应暴露给用户
2. **删除即损坏**：用户删掉这串字符后，创意无法正常创建（因为保存校验要求 content 非空），或创建后媒体加载失败
3. **阻碍编辑**：用户想在内容区写文字，但 `media://` 占据了内容字段，删掉又导致媒体丢失

### 根因

当前系统使用**双重关联机制**：
- **正向引用**：`creativities.content = 'media://ID'` — 在 content 字段嵌入 media 引用
- **反向引用**：`media.creativity_id = CREATIVITY_ID` — media 表通过外键关联

`media://` 写入 content 是冗余的，因为 `creativity_id` 外键已经建立了关联。但前端显示组件（`toMediaUrl()`）依赖 `content` 中的 `media://` 前缀来解析媒体路径。

### 解决思路

**将 `media://` 从 content 中移除，完全依赖 `media.creativity_id` 外键关联**。具体做法：

1. 编辑器不再将 `media://` 写入 content
2. 后端在返回创意数据时，对媒体类型始终通过 `creativity_id` 反查 media 表，将解析后的文件路径注入返回数据
3. 前端显示组件使用后端返回的文件路径（而非 `media://` 引用）来渲染媒体

## 修改方案

### 修改 1：后端 `creativity.ts` — 始终解析媒体文件路径

**文件**：`src/main/ipc/creativity.ts`

**`creativity:list` 处理器**（约第 116-124 行）：

当前逻辑：仅在 `!item.content` 时才从 media 表补充 filepath

改为：对媒体类型（image/video/audio/document）**始终**从 media 表查询，将 filepath 注入 `mediaFilePath` 字段；同时保留原有的 content 补充逻辑（当 content 为空时仍写入 filepath，保证向后兼容）

```typescript
// 修改前：
if ((item.type === 'image' || item.type === 'video' || item.type === 'audio') && !item.content) {
  try {
    const mediaRecord = repo.db.prepare('SELECT filepath FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
    if (mediaRecord) {
      item.content = mediaRecord.filepath;
    }
  } catch (_) {}
}

// 修改后：
if (['image', 'video', 'audio', 'document'].includes(item.type)) {
  try {
    const mediaRecord = repo.db.prepare('SELECT filepath FROM media WHERE creativity_id = ? ORDER BY sort_order ASC LIMIT 1').get(item.id);
    if (mediaRecord) {
      item.mediaFilePath = mediaRecord.filepath;
      if (!item.content) {
        item.content = mediaRecord.filepath;
      }
    }
  } catch (_) {}
}
```

**`creativity:read` 处理器**（约第 167-176 行）：同样修改

### 修改 2：前端类型 `types.ts` — 添加 `mediaFilePath` 字段

**文件**：`src/shared/types.ts`

在 `Creativity` 接口中添加：

```typescript
mediaFilePath?: string;
```

### 修改 3：QuickCapture — 不再将 `media://` 写入 content

**文件**：`src/renderer/components/quick-capture/QuickCapture.tsx`

**3a. 粘贴图片时**（约第 279-281 行）：

删除：
```typescript
if (!content.trim() && mediaData.id) {
  setContent('media://' + mediaData.id);
}
```

**3b. 保存时的 media:// 注入**（约第 322-328 行）：

删除：
```typescript
if ((type === 'image' || type === 'video' || type === 'audio' || type === 'document') && selectedMediaFiles.length > 0 && !saveContent) {
  const firstMedia = selectedMediaFiles[0];
  const mediaData = firstMedia.data || firstMedia;
  if (mediaData && mediaData.id) {
    saveContent = 'media://' + mediaData.id;
  }
}
```

**3c. 选择附件时**（约第 669-671 行）：

删除：
```typescript
if (!content.trim() && file.id) {
  setContent('media://' + file.id);
}
```

**3d. 保存校验**（约第 307 行）：

```typescript
// 修改前：
if (!title.trim() && !content.trim() && !audioBlob) return;

// 修改后：
if (!title.trim() && !content.trim() && !audioBlob && selectedMediaFiles.length === 0) return;
```

**3e. 保存按钮禁用条件**（约第 1261 行）：

```typescript
// 修改前：
disabled={isSaving || (!title.trim() && !content.trim() && !audioBlob)}

// 修改后：
disabled={isSaving || (!title.trim() && !content.trim() && !audioBlob && selectedMediaFiles.length === 0)}
```

**3f. 拖拽文件预填时**（约第 279 行附近，pendingFiles 处理中）：

删除 `setContent('media://' + mediaData.id)` 相关逻辑

### 修改 4：CardEditor — 不再将 `media://` 写入 content

**文件**：`src/renderer/components/card/CardEditor.tsx`

**4a. 拖拽文件时**（约第 137-140 行）：

删除：
```typescript
if (!content.trim() && result.data.id) {
  setContent('media://' + result.data.id);
  setDirty(true);
}
```

**4b. 粘贴图片时**（约第 360-363 行）：

删除：
```typescript
if (!content.trim() && mediaData && mediaData.id) {
  setContent('media://' + mediaData.id);
  setDirty(true);
}
```

**4c. 选择附件时**（约第 1011-1014 行）：

删除：
```typescript
if (!content.trim() && firstFile.id) {
  setContent('media://' + firstFile.id);
  setDirty(true);
}
```

### 修改 5：CardPreview — 不再将 `media://` 写入 content

**文件**：`src/renderer/components/card/CardPreview.tsx`

**5a. 添加附件时**（约第 805-808 行）：

删除：
```typescript
if (firstFile.id && (!creativity.content || !creativity.content.trim())) {
  setEditContent('media://' + firstFile.id);
  setIsDirty(true);
}
```

**5b. 图片标注保存时**（约第 1190 行）：

将 `content: 'media://' + newMedia.id` 改为 `content: ''`（或保留用户原有文本），媒体通过 `creativity_id` 关联

### 修改 6：CanvasView — 不再将 `media://` 写入 content

**文件**：`src/renderer/components/board/CanvasView.tsx`

**6a. 拖入文档文件时**（约第 1040 行）：

将 `content: mediaResult.data.id ? 'media://' + mediaResult.data.id : (mediaResult.data.filePath || '')` 改为 `content: ''`

**6b. 拖入媒体文件时**（约第 1083 行）：

同上

### 修改 7：前端显示组件 — 使用 `mediaFilePath` 渲染媒体

所有使用 `toMediaUrl(creativity.content)` 渲染媒体的地方，改为优先使用 `creativity.mediaFilePath`：

**模式**：`toMediaUrl(creativity.mediaFilePath || creativity.content)`

涉及文件：
- `Home.tsx`：闪回区域媒体展示（约第 788 行）
- `CardPreview.tsx`：图片/视频/音频展示
- `Search.tsx`：`MediaThumbnail` 组件（已通过 `useVideoThumbnail` 独立处理）
- `CanvasView.tsx`：画布中媒体展示

### 修改 8：后端 `media.ts` — `media:save` 时自动关联 `creativity_id`

**文件**：`src/main/ipc/media.ts`

当前 `media:save` 在保存媒体记录时，如果传入了 `creativityId`，会直接写入 `creativity_id`。但 QuickCapture 新建时没有 `creativityId`（创意尚未创建），所以使用 `pendingMediaIds` + `linkToCreativity` 事后关联。

这个机制已经存在且正常工作，无需修改。只需确保 QuickCapture/CardEditor 的保存流程中 `linkToCreativity` 被正确调用（已验证 App.tsx 的 `handleSave` 和 CardEditor 的 `handleSave` 都有此逻辑）。

## 向后兼容

- 已有数据中 `content` 可能包含 `media://ID` 或文件路径，显示组件使用 `mediaFilePath || content` 兼容
- 后端在 `content` 为空时仍会补充 filepath（保持原有行为）
- 新创建的创意不再在 content 中写入 `media://`

## 预期效果

1. **编辑器干净**：内容区只显示用户输入的文字，不再出现 `media://` 字符串
2. **媒体不丢失**：删除内容文字不影响媒体文件的关联和显示
3. **自由编辑**：用户可以在有媒体附件的同时自由编写文字内容
4. **向后兼容**：已有数据的 `media://` 引用仍能正常解析显示

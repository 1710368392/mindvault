# 回收站缩略图显示问题修复方案

## 问题分析

经过代码审查，发现回收站缩略图不显示的根本原因在于 `extractAndRegisterMediaFromSnapshot` 函数的逻辑缺陷：

1. **后端逻辑** ✅ 正常工作：删除创意时会正确获取媒体路径（`mediaFilePath`、`thumbnailPath`）并保存到快照中

2. **前端注册逻辑** ❌ 存在问题：
   - `extractAndRegisterMediaFromSnapshot` 函数在处理 `mediaFilePath` 时使用随机生成的临时ID注册（如 `snapshot_abc123`）
   - 但当 `ListThumbnailCell` 调用 `toMediaUrl(media://media_xxx)` 时，查找的是实际的媒体ID（如 `media_xxx`）
   - 由于注册时使用的是临时ID，导致缓存查找失败，无法正确解析媒体路径

## 修复方案

修改 `src/renderer/utils/media.ts` 中的 `extractAndRegisterMediaFromSnapshot` 函数：

### 修改前（问题代码）
```typescript
// 提取 mediaFilePath
if (snapshot.mediaFilePath) {
  if (isLocalFilePath(snapshot.mediaFilePath) && !snapshot.mediaFilePath.startsWith('media://')) {
    const tempId = 'snapshot_' + Math.random().toString(36).substr(2, 9);
    mediaRecords.push({ id: tempId, filePath: snapshot.mediaFilePath });
  }
}
```

### 修改后（修复代码）
```typescript
// 提取 mediaFilePath - 优先使用 content 中的媒体ID
if (snapshot.mediaFilePath) {
  if (isLocalFilePath(snapshot.mediaFilePath) && !snapshot.mediaFilePath.startsWith('media://')) {
    let mediaId: string | null = null;
    
    // 尝试从 content 中提取媒体ID
    if (snapshot.content && typeof snapshot.content === 'string' && snapshot.content.startsWith('media://')) {
      mediaId = extractMediaId(snapshot.content);
    }
    
    // 如果能提取到媒体ID，用它注册；否则使用临时ID
    if (mediaId) {
      mediaRecords.push({ id: mediaId, filePath: snapshot.mediaFilePath });
    } else {
      const tempId = 'snapshot_' + Math.random().toString(36).substr(2, 9);
      mediaRecords.push({ id: tempId, filePath: snapshot.mediaFilePath });
    }
  }
}
```

## 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/renderer/utils/media.ts` | 修改 `extractAndRegisterMediaFromSnapshot` 函数，优先使用 `content` 中的媒体ID注册媒体路径 |

## 风险评估

- **低风险**：仅修改媒体路径注册逻辑，不影响其他功能
- **向后兼容**：修复后旧数据和新数据都能正确处理
- **影响范围**：仅影响回收站页面的缩略图显示

## 验证方案

1. 删除一个包含图片/视频的创意到回收站
2. 进入回收站页面查看是否显示缩略图
3. 验证不同类型创意（image、video）的缩略图都能正确显示
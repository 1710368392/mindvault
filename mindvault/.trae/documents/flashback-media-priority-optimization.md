# 灵感闪回组件优化 — 媒体优先展示

## 问题分析

当前灵感闪回卡片对媒体文件的展示存在以下问题：

1. **图片**：`maxHeight: 200px` + `objectFit: 'cover'` → 图片被裁切，无法完整展示
2. **视频**：`maxHeight: 240px` + 无 objectFit → 视频也被限制高度，可能裁切
3. **组件尺寸固定**：卡片使用 `flex: 1` + `overflow: 'hidden'`，不会根据媒体内容自适应扩展
4. **所有类型共用同一布局**：纯文本和媒体类型没有差异化尺寸策略

**核心矛盾**：组件尺寸由外层网格决定，媒体文件被迫适应固定容器，而非容器适应媒体。

## 优化目标

> 对于非纯文本类型的创意，展示时优先以媒体文件的尺寸为基准去进行该组件的尺寸变化，力求先完整展示媒体文件。超大媒体通过等比缩小适配展示区域。

## 实现方案

### 步骤 1：新增媒体尺寸状态管理

**文件**: `src/renderer/pages/Home.tsx`

在灵感闪回相关状态区域（约第 198-203 行附近）新增：

```tsx
const [flashbackMediaSize, setFlashbackMediaSize] = useState<{ width: number; height: number } | null>(null);
```

用于记录当前媒体文件的实际展示尺寸，驱动组件自适应。

### 步骤 2：图片展示 — 等比缩放 + 容器自适应

**文件**: `src/renderer/pages/Home.tsx` (第 761-766 行)

**核心思路**：
- 图片加载后通过 `onLoad` 获取原始尺寸 (`naturalWidth`, `naturalHeight`)
- 根据容器宽度和最大高度上限 (400px)，计算等比缩放后的展示尺寸
- 容器高度设为缩放后的实际高度，消除留白
- `objectFit` 改为 `'contain'`，确保完整展示无裁切

```tsx
if (flashback.type === 'image') {
  const MAX_IMG_HEIGHT = 400;
  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 8,
      overflow: 'hidden',
      height: flashbackMediaSize ? flashbackMediaSize.height : undefined,
    }}>
      <img
        src={mediaUrl}
        alt=""
        style={{
          width: '100%',
          maxHeight: MAX_IMG_HEIGHT,
          objectFit: 'contain',
          display: 'block',
        }}
        onLoad={(e) => {
          const img = e.currentTarget;
          const containerWidth = img.parentElement?.clientWidth || img.clientWidth;
          const scale = Math.min(
            containerWidth / img.naturalWidth,
            MAX_IMG_HEIGHT / img.naturalHeight,
            1
          );
          setFlashbackMediaSize({
            width: Math.round(img.naturalWidth * scale),
            height: Math.round(img.naturalHeight * scale),
          });
        }}
      />
    </div>
  );
}
```

**等比缩放逻辑说明**：
- `containerWidth / naturalWidth`：按宽度适配的缩放比
- `MAX_IMG_HEIGHT / naturalHeight`：按高度上限适配的缩放比
- `1`：不放大，只缩小
- 取三者最小值，确保图片完整展示且不超出上限

### 步骤 3：视频展示 — 等比缩放 + 容器自适应

**文件**: `src/renderer/pages/Home.tsx` (第 768-786 行)

**核心思路**：与图片相同的等比缩放策略，通过 `onLoadedMetadata` 获取视频原始尺寸。

```tsx
if (flashback.type === 'video') {
  const saved = flashbackPlayingState.current[flashback.id];
  const MAX_VIDEO_HEIGHT = 400;
  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 8,
      overflow: 'hidden',
      height: flashbackMediaSize ? flashbackMediaSize.height : undefined,
    }}>
      <video
        ref={flashbackVideoRef}
        src={mediaUrl}
        loop
        autoPlay={saved?.playing !== false}
        controls
        style={{
          width: '100%',
          maxHeight: MAX_VIDEO_HEIGHT,
          objectFit: 'contain',
          borderRadius: 8,
          display: 'block',
        }}
        onLoadedMetadata={() => {
          const video = flashbackVideoRef.current;
          if (video) {
            if (saved) {
              video.currentTime = saved.currentTime;
            }
            const containerWidth = video.parentElement?.clientWidth || video.clientWidth;
            const scale = Math.min(
              containerWidth / video.videoWidth,
              MAX_VIDEO_HEIGHT / video.videoHeight,
              1
            );
            setFlashbackMediaSize({
              width: Math.round(video.videoWidth * scale),
              height: Math.round(video.videoHeight * scale),
            });
          }
        }}
      />
    </div>
  );
}
```

### 步骤 4：切换创意时重置媒体尺寸

**文件**: `src/renderer/pages/Home.tsx` — `loadFlashback` 函数内

在 `setFlashback(random)` 之前添加 `setFlashbackMediaSize(null)`，确保切换创意时重新计算新媒体的尺寸：

```tsx
setFlashbackMediaSize(null);
setFlashback(random);
```

### 步骤 5：卡片内容区 — 允许内容撑开

**文件**: `src/renderer/pages/Home.tsx` (第 716-726 行)

**改动**：
- `overflow: 'hidden'` → `overflow: 'visible'`，允许媒体内容撑开卡片
- 保留 `flex: 1`，添加 `minHeight: 0` 保持弹性

```tsx
style={{ 
  padding: '16px', 
  borderRadius: '8px', 
  cursor: 'pointer', 
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'visible',
  ...
}}
```

### 步骤 6：外层 Card 容器 — 允许高度自适应

**文件**: `src/renderer/pages/Home.tsx` (第 707 行)

```tsx
// 修改前
style={{ height: '100%', display: 'flex', flexDirection: 'column' }}

// 修改后
style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'visible' }}
```

### 步骤 7：CSS 样式调整 — 网格行高自适应

**文件**: `src/renderer/styles/globals.css` (第 505-531 行)

```css
.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 280px;
  grid-auto-rows: min-content;
  align-items: start;
  gap: 20px;
  margin-bottom: 20px;
}
```

- `grid-auto-rows: min-content`：行高由内容决定
- `align-items: start`：各列独立高度，顶部对齐

### 步骤 8：音频类型保持不变

音频控件本身尺寸固定（32px 高度），无需调整，维持现有展示方式。

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/renderer/pages/Home.tsx` | 新增媒体尺寸状态、图片/视频等比缩放逻辑、卡片 overflow、Card 高度策略 |
| `src/renderer/styles/globals.css` | 网格行高自适应 |

## 等比缩放效果示意

```
原始图片 1920x1080，容器宽度 400px，MAX_HEIGHT=400px

缩放比计算：
  宽度比 = 400 / 1920 = 0.208
  高度比 = 400 / 1080 = 0.370
  不放大 = 1
  取最小 = 0.208

展示尺寸：400 x 225（完整展示，无裁切，无留白）
容器高度：225px（精确适配）

---

原始图片 800x600，容器宽度 400px，MAX_HEIGHT=400px

缩放比计算：
  宽度比 = 400 / 800 = 0.5
  高度比 = 400 / 600 = 0.667
  不放大 = 1
  取最小 = 0.5

展示尺寸：400 x 300（完整展示，无裁切，无留白）
容器高度：300px（精确适配）

---

原始图片 300x200，容器宽度 400px，MAX_HEIGHT=400px

缩放比计算：
  宽度比 = 400 / 300 = 1.333
  高度比 = 400 / 200 = 2
  不放大 = 1
  取最小 = 1（不放大）

展示尺寸：300 x 200（原始尺寸，居中展示）
```

## 风险评估

- **布局偏移**：卡片高度不再固定，三栏高度可能不一致。通过 `align-items: start` 让各列独立高度，顶部对齐，视觉自然
- **超大图片**：`MAX_HEIGHT=400` 上限 + 等比缩小，确保不会撑破页面
- **纯文本类型不受影响**：文本类型没有媒体展示区，布局逻辑不变
- **切换闪烁**：切换创意时先重置 `flashbackMediaSize` 为 null，再加载新媒体尺寸，可能有短暂高度变化。通过 AnimatePresence 的动画过渡缓解

# 修复瀑布流卡片缩略图区域固定高度导致显示不全

## 问题分析

用户明确指出：瀑布流布局的每张卡片分为上下两部分：
- **上部分**：展示创意缩略图（视频帧/图片/图标）
- **下部分**：展示文字信息（标题、内容、标签等）

下部分文字展示没有问题。**关键问题在上部分**——上部分的高度被固定为 120px，这才是导致视频/图片缩略图显示不全的根本原因。

16:9 的视频帧在卡片宽度 200-300px 时，完整显示需要 112-169px 高度，固定 120px 必然导致裁剪。

## 当前代码状态

`MediaThumbnail` 组件（Search.tsx 第 103-162 行）已修改为：
- 视频/图片类型：容器 `width: '100%'`，内部 `<img>` 用 `width: '100%'` + `height: 'auto'`
- 图标类型：容器 `width: size, height: size`（固定尺寸）

**但调用处（第 937-943 行）仍然传入 `style={{ borderRadius: 0, width: '100%', height: 120 }}`，这个 `height: 120` 会通过 `...style` 展开覆盖掉组件内部的 `height: auto`，导致高度仍然被固定！**

## 修复方案

### 修改 1：`Search.tsx` 第 937-943 行 — 调用处根据类型动态设置高度

将：
```tsx
<MediaThumbnail
  type={c.type}
  content={c.content}
  size={120}
  iconSize={32}
  style={{ borderRadius: 0, width: '100%', height: 120 }}
/>
```

改为：
```tsx
<MediaThumbnail
  type={c.type}
  content={c.content}
  size={120}
  iconSize={32}
  style={{
    borderRadius: 0, width: '100%',
    ...(c.type === 'video' || c.type === 'image' ? {} : { height: 120 }),
  }}
/>
```

- 视频/图片类型：不传 `height`，让 `MediaThumbnail` 组件内部的 `height: auto` 生效，缩略图按原始宽高比自适应展示
- 其他类型（文字、音频等）：保持 `height: 120`，用于图标居中展示

### 修改 2：`MediaThumbnail` 组件 — 确保视频/图片容器高度自适应

当前视频分支的容器样式是 `width: '100%', overflow: 'hidden', flexShrink: 0`，然后 `...style` 展开。当 `style` 中不含 `height` 时，容器高度由内部 `<img>` 的 `height: auto` 撑开，这是正确的。

但需要确认：当 `style` 中没有 `height` 时，容器不会被其他样式影响。当前代码逻辑已经正确，无需额外修改。

### 修改 3：`Home.tsx` 的 `HomeThumbnail` — 无需修改

首页的 `HomeThumbnail` 用于列表式布局（size=32px 的小缩略图），不是瀑布流，不存在高度裁剪问题，无需修改。

## 预期效果

- 视频类卡片：缩略图按 16:9 宽高比完整显示，高度自适应（约 112-169px 取决于卡片宽度）
- 图片类卡片：缩略图按原始宽高比完整显示
- 文字/音频/其他类卡片：保持 120px 固定高度，图标居中展示
- 瀑布流布局会自动根据卡片高度差异排列，不会出现空白或错位

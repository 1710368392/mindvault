# 修复竖屏视频容器未收窄问题

## 问题分析

容器层级结构（从外到内）：

```
Carousel (Ant Design, effect="fade")
  └─ div (Carousel slide wrapper) ← Ant Design 自动生成，宽度 100%
      └─ div key={fb.id} ← 第945行，无样式限制
          └─ div.flashback-card ← 第946行，padding: 16px 8px，无宽度限制
              ├─ 标题、类型标签等（block 元素，撑满宽度）
              └─ div (视频容器) ← 第1032行，width: fit-content, margin: 0 auto
                  └─ FlashbackVideoPlayer ← width: fit-content
                      └─ video ← width: 100%
```

**根因**：`width: fit-content` + `margin: 0 auto` 只能让元素自身居中，但上层的 `.flashback-card` 和 Carousel slide wrapper 都是 `width: 100%` 的块级元素。即使视频容器收窄了，`.flashback-card` 仍然撑满整个卡片宽度，视觉上看起来容器没有收窄。

**关键问题**：`.flashback-card`（第946行）没有宽度约束，作为块级元素默认 `width: 100%`，它撑满了 Carousel slide 的宽度。视频容器虽然在 `.flashback-card` 内部居中了，但 `.flashback-card` 本身没有收窄，所以两侧的 padding 区域和背景色仍然占满全宽。

## 修复方案

不需要让整个卡片收窄（标题等文本内容应该保持全宽），只需要让**视频/图片容器**在卡片内正确居中显示即可。当前 `width: fit-content` + `margin: 0 auto` 的方案本身是正确的，问题在于外层 `.flashback-card` 的 `overflow: hidden` 可能在裁剪，或者视觉上 `.flashback-card` 的背景色让用户误以为容器没收窄。

实际上，`width: fit-content` + `margin: 0 auto` 应该能让视频容器在 `.flashback-card` 内水平居中。如果视觉上没看到收窄，可能的原因是：

1. `FlashbackVideoPlayer` 的 `width: fit-content` 被外层 `style` 中的 `width: scaledWidth` 覆盖了——但 `fit-content` 是在组件内部设置的，外部 `style` 通过 `...style` 展开覆盖了它
2. 外部传入的 `playerStyle` 中 `width: scaledWidth` 直接设在了 FlashbackVideoPlayer 的容器 div 上，但容器 div 内部又有 `width: fit-content`，两者冲突

让我重新检查 FlashbackVideoPlayer 的样式合并逻辑：

```tsx
// FlashbackVideoPlayer.tsx 第239行
style={{ position: 'relative', width: 'fit-content', ...style }}
```

`...style` 在 `width: fit-content` 之后展开，所以外部传入的 `width: scaledWidth` 会覆盖 `fit-content`。这意味着当竖屏视频时，FlashbackVideoPlayer 容器宽度被设为 `scaledWidth`（如 253px），video 元素 `width: 100%` 撑满 253px。这应该是正确的。

但外层 div（第1032行）也有 `width: fit-content`，它应该收缩到 FlashbackVideoPlayer 的宽度。而 `.flashback-card` 是 `width: 100%` 的块级元素，视频容器在其中通过 `margin: 0 auto` 居中。

**真正的问题**：`.flashback-card` 的 `overflow: hidden`（第952行）不会影响居中。但 `.flashback-card` 有 `backgroundColor`，即使视频容器居中了，卡片背景仍然占满全宽，视觉上看起来"没有收窄"。

### 解决方案

用户期望的效果是：竖屏视频时，视频两侧不要有多余的背景区域（黑边或卡片背景）。有两种方式：

**方案A**：让 `.flashback-card` 也收窄到内容宽度（不推荐，标题等文本会受影响）

**方案B**：保持 `.flashback-card` 全宽，但视频容器区域确实居中且收窄。当前代码逻辑已经是这样，如果用户仍然看到"没收窄"，可能是因为 `.flashback-card` 的背景色在视频两侧形成了视觉上的"留白"。

**方案C（推荐）**：去掉 `.flashback-card` 的 `overflow: hidden`，确认视频容器确实居中。如果问题是 FlashbackVideoPlayer 内部的 `width: fit-content` 被外部 style 覆盖后没有正确生效，需要确保样式优先级正确。

经过仔细分析，我认为问题在于：当竖屏视频设置了 `width: scaledWidth`（如 253px）后，FlashbackVideoPlayer 容器确实是 253px 宽，video 也是 253px 宽。但外层 div（第1032行）的 `width: fit-content` 会收缩到 253px，然后 `margin: 0 auto` 在 `.flashback-card` 内居中。这应该是正确的。

**但如果 Ant Design Carousel 的 fade 效果使用了绝对定位**，那么 Carousel slide 可能不会根据内容高度自适应，而是使用第一个 slide 的高度。这可能导致 `margin: 0 auto` 的居中效果在某些情况下不生效。

### 最终方案

确认 Carousel 的 `adaptiveHeight` 是否生效，以及视频容器的 `margin: 0 auto` 是否在正确的上下文中工作。如果问题确实存在，最简单的修复是确保视频容器外层 div 不使用 `width: fit-content`，而是使用 `display: flex; justify-content: center` 来居中，这样不需要收窄外层容器。

## 修改步骤

1. **Home.tsx 视频外层 div**（第1032行）：将 `width: fit-content, maxWidth: 100%, margin: 0 auto` 改为 `display: flex, justifyContent: center`，让视频在卡片内居中而不需要收窄外层容器
2. **FlashbackVideoPlayer 容器**：保持 `width: fit-content`，当外部传入 `width: scaledWidth` 时，`...style` 覆盖 `fit-content` 为具体像素值，容器宽度正确
3. **FlashbackVideoPlayer video 元素**：保持 `width: 100%`，撑满容器

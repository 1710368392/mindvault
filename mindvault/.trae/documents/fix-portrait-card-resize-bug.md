# 修复竖屏多媒体卡片缩放边缘检测 Bug

## 问题描述

竖屏多媒体文件卡片的缩放边缘检测出错：
- 上半部分卡片边缘触发正常
- 下半部分左右两边边缘触发变成了对角拉伸（应该是水平拉伸）
- 底边触发正常
- 视频下半部分面积内误触发纵向拉伸

## 根本原因分析

### 卡片 DOM 结构

```
外层 div (position: absolute, width: item.width, height: item.height, 无 overflow: hidden)
  └── 内层 div (padding: 16, overflow: hidden, flex column)
        ├── 标题 div
        └── 视频容器 div (overflow: hidden, 无显式高度)
              └── video (width: 100%, 高度由宽高比自动计算)
```

### 问题根源

外层 div 设置了 `height: item.height`，但**没有 `overflow: hidden`**。

对于竖屏视频，视频按 `width: 100%` 渲染后，其高度由视频自身宽高比计算，可能**超过**外层 div 的 `item.height`。视频内容溢出外层 div，视觉上仍然可见。

但 `getBoundingClientRect()` 返回的是外层 div 的 **CSS 高度**（`item.height`），不是视觉高度。

当鼠标在溢出区域（y > item.height）时：
- `y > h - EDGE_THRESHOLD` → `nearBottom = true`
- 如果同时 `nearLeft = true` → 返回 `'sw'`（对角拉伸），而不是 `'w'`（水平拉伸）

这完美解释了用户描述的所有现象。

### 之前方案的失败原因

之前的方案添加了 `overflow: hidden` + `flex: 1` + `objectFit: contain`，这会把媒体强制缩小到卡片 CSS 尺寸内，导致竖屏视频被无脑缩小，视觉效果很差。

## 修改计划

### 核心思路

**不改变卡片的渲染方式**（保持媒体自然尺寸），而是**修复边缘检测的坐标系**。

具体方案：在 `detectResizeEdge` 中，不使用 `getBoundingClientRect()` 的 CSS 高度，而是使用元素的 `scrollHeight`（包含溢出内容的实际高度）来计算边缘检测。

### 步骤 1：修改 `detectResizeEdge` 函数

**文件**：`CanvasView.tsx` 第 864-890 行

将 `rect.height` 替换为 `e.currentTarget.scrollHeight`，这样边缘检测使用的是卡片的**视觉高度**（包含溢出内容），而不是 CSS 高度。

```typescript
const detectResizeEdge = useCallback((e: React.MouseEvent, item: BoardCanvasItem): string | null => {
    const displayType = item.type || (item.creativity?.type) || 'text';
    if (displayType !== 'image' && displayType !== 'video') return null;
    if (canvasToolMode !== 'hand') return null;

    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = el.scrollHeight;  // 使用 scrollHeight 代替 rect.height

    const nearTop = y < EDGE_THRESHOLD;
    const nearBottom = y > h - EDGE_THRESHOLD;
    const nearLeft = x < EDGE_THRESHOLD;
    const nearRight = x > w - EDGE_THRESHOLD;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';

    return null;
}, [canvasToolMode]);
```

### 步骤 2：回滚之前方案的所有修改

需要回滚之前执行方案中添加的 `overflow: hidden`、`flex: 1`、`minHeight: 0`、`objectFit: contain`、`height: 100%` 等修改（如果有的话），恢复媒体的自然渲染方式。

具体需要检查和回滚：
1. 外层 div 的 `overflow: hidden` → 移除
2. 视频容器的 `flex: 1, minHeight: 0` → 移除
3. CanvasVideoPlayer 的 video `height: 100%, objectFit: contain` → 移除
4. img 的 `height: 100%, objectFit: contain` → 移除

## 预期效果

1. 竖屏视频卡片的边缘检测正确（左右边缘只触发水平拉伸，不会误触发对角拉伸）
2. 视频下半部分不再误触发纵向拉伸
3. 媒体保持自然渲染，不会被强制缩小
4. 横屏视频卡片的行为不受影响

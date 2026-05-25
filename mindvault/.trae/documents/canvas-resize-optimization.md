# 画布多媒体卡片缩放交互优化计划

## 问题描述

当前多媒体卡片（图片/视频）的缩放操作存在体验问题：
- **光标压根不变化**：鼠标靠近卡片边缘时，光标不会变成缩放光标
- 缩放操作的"落点"不明确，边缘热区只有 6px
- 用户希望：只要鼠标在卡片四周边缘，就能直接进行拉伸操作

## 根本原因分析

### Bug 1：光标不变化

**文件**：[CanvasView.tsx](file:///d:/Android/Code/naodong/mindvault/src/renderer/components/board/CanvasView.tsx)

第 2772 行 inline style 中 `cursor: undefined`，导致 React 每次重新渲染时重置光标样式，覆盖掉 `onMouseMove` 中动态设置的光标。由于画布视图频繁重新渲染，光标会被不断重置。

### Bug 2：图片没有设置 `width: 100%`

第 2879 行，`<img>` 的 style 只有 `{ display: 'block' }`，没有 `width: '100%'`。这意味着当卡片宽度被缩放改变时，图片不会自动填满卡片宽度，导致图片和卡片尺寸不匹配。

### 关于"不跟手"的分析

用户担心：拖动卡片边缘 → 媒体尺寸变化 → 卡片尺寸间接变化，这个链路可能导致不跟手。

**结论：不会出现不跟手的情况**，前提是正确实现。关键在于采用 **"卡片尺寸 → 媒体填满卡片"** 的模式，而不是 **"媒体尺寸 → 卡片自适应"** 的模式：

| 模式 | 流程 | 是否跟手 |
|------|------|---------|
| 卡片尺寸 → 媒体填满 | 鼠标拖动 → 直接设置卡片 width/height → 媒体通过 CSS `width:100%` 立即填满 | ✅ 跟手，无延迟 |
| 媒体尺寸 → 卡片自适应 | 鼠标拖动 → 设置媒体 width/height → 浏览器重新布局 → 卡片通过 `fit-content` 适应 | ❌ 可能有延迟 |

当前实现已经是"卡片尺寸 → 媒体填满"的模式，只需要确保图片/视频有 `width: 100%` 即可保证跟手。

## 修改计划

### 步骤 1：修复光标不变化的 Bug（核心修复）

**文件**：`CanvasView.tsx`

使用 state 变量追踪当前光标状态，将其纳入 inline style，避免 React 重新渲染时重置光标。

1. 添加 state：`const [hoveredResizeCursor, setHoveredResizeCursor] = useState<{itemId: string, cursor: string} | null>(null);`

2. 修改 `onMouseMove` 处理器（第 2776-2781 行），使用 `setHoveredResizeCursor` 代替直接操作 DOM：
   ```jsx
   onMouseMove={(e) => {
     if (canvasToolMode === 'hand' && isNaturalSizeMedia && !draggingItemId && !resizingItemId) {
       const edge = detectResizeEdge(e, item);
       const cursor = edge ? getResizeCursor(edge) : 'grab';
       setHoveredResizeCursor({ itemId: item.id, cursor });
     }
   }}
   ```

3. 修改 `onMouseLeave` 处理器（第 2783-2786 行）：
   ```jsx
   onMouseLeave={() => {
     if (canvasToolMode === 'hand' && isNaturalSizeMedia) {
       setHoveredResizeCursor(null);
     }
   }}
   ```

4. 修改 inline style 中的 cursor 属性（第 2772 行）：
   ```jsx
   cursor: isCanvasConnecting ? 'crosshair'
     : (canvasToolMode === 'hand' && isNaturalSizeMedia) ? (hoveredResizeCursor?.itemId === item.id ? hoveredResizeCursor.cursor : 'grab')
     : canvasToolMode === 'hand' ? (draggingItemId === item.id ? 'grabbing' : 'grab')
     : 'pointer',
   ```

5. 缩放结束时也需要清除光标状态（在 `handleMouseUp` 中添加）：
   ```jsx
   if (resizingItemId) {
     setResizingItemId(null);
     setResizeDirection(null);
     setHoveredResizeCursor(null);  // 清除光标状态
   }
   ```

### 步骤 2：增大边缘热区阈值

**文件**：`CanvasView.tsx` 第 861 行

将 `EDGE_THRESHOLD` 从 `6` 增大到 `10`，让用户更容易触发缩放操作。

### 步骤 3：确保媒体填满卡片（保证跟手）

**文件**：`CanvasView.tsx` 卡片渲染部分

1. 图片添加 `width: '100%'`（第 2879 行）：
   ```jsx
   <img
     src={toMediaUrl(displayContent!)}
     alt={displayTitle || ''}
     style={{ display: 'block', width: '100%' }}
     ...
   />
   ```

2. 视频（CanvasVideoPlayer）也需要确保填满卡片宽度，检查其内部是否有 `width: 100%` 样式。

### 步骤 4：修复缩放时卡片位置不更新的问题

**文件**：`CanvasView.tsx` 缩放逻辑（第 1531-1588 行）

当前缩放逻辑只更新了卡片的 `width/height`，但对于 `n`（北）、`w`（西）、`nw`（西北）、`ne`（东北）、`sw`（西南）方向的缩放，卡片的位置（`positionX/positionY`）也需要相应更新，否则卡片会向错误的方向扩展。

例如，当用户向上拖动顶部边缘时：
- 高度增加 `dy`
- 卡片的 `positionY` 应该减少 `dy`（向上移动）

需要在缩放逻辑中添加位置更新：
```jsx
// 计算位置偏移
let newX = item.positionX;
let newY = item.positionY;
if (dir === 'n' || dir === 'nw' || dir === 'ne') {
  newY = item.positionY + (resizeStart.height - newH);
}
if (dir === 'w' || dir === 'nw' || dir === 'sw') {
  newX = item.positionX + (resizeStart.width - newW);
}
// 更新位置
updateCanvasItemPosition(resizingItemId, newX, newY);
```

需要检查 `boardStore` 中是否有 `updateCanvasItemPosition` 方法，如果没有需要添加。

## 预期效果

1. 鼠标靠近卡片边缘时，光标正确变为缩放光标（核心修复）
2. 边缘热区从 6px 增大到 10px，更容易触发缩放
3. 缩放过程中卡片完全跟手，无延迟
4. 所有方向的缩放都能正确更新卡片位置

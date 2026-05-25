# 修复多选拖拽抖动和不跟手问题

## 问题根因分析

当前多选拖拽的核心问题在于 `handleMouseMove` 中的拖拽逻辑：

```typescript
// 当前代码 (CanvasView.tsx 第1564-1582行)
if (draggingItemId) {
  const canvasPos = screenToCanvas(e.clientX, e.clientY);
  const dx = canvasPos.x - dragOffset.x - (canvasItems.find(i => i.id === draggingItemId)?.positionX || 0);
  const dy = canvasPos.y - dragOffset.y - (canvasItems.find(i => i.id === draggingItemId)?.positionY || 0);

  if (selectedCanvasItemIds.length > 1 && selectedCanvasItemIds.includes(draggingItemId)) {
    for (const id of selectedCanvasItemIds) {
      const item = canvasItems.find(i => i.id === id);
      if (item) {
        updateCanvasItemPosition(id, Math.round(item.positionX + dx), Math.round(item.positionY + dy));
      }
    }
  } else {
    const x = canvasPos.x - dragOffset.x;
    const y = canvasPos.y - dragOffset.y;
    updateCanvasItemPosition(draggingItemId, Math.round(x), Math.round(y));
  }
}
```

**问题1：每次mousemove都调用API** — `updateCanvasItemPosition` 内部 `await api.board.canvas.updatePosition()`，选中N个节点就是N次API调用 + N次store更新 + N次重渲染，严重拖慢帧率。

**问题2：dx/dy计算依赖过时状态** — `canvasItems.find(i => i.id === id)?.positionX` 读取的是store中的位置，但上一次 `updateCanvasItemPosition` 的 `set()` 可能还没生效，导致dx/dy计算不一致，产生抖动。

**问题3：逐个更新store** — N个节点逐个调用 `set()`，每次 `set()` 触发一次重渲染，导致中间帧显示不一致。

## 修复方案

### 核心思路
- **拖拽过程中只更新本地store，不调用API**
- **使用ref记录所有选中项的起始位置**，基于起始位置 + 总增量计算新位置，避免依赖过时状态
- **拖拽结束后批量同步到服务端**
- **单次 `set()` 更新所有选中项位置**，避免多次重渲染

### 实施步骤

#### 步骤1：在 boardStore.ts 中添加两个新方法

1. **`batchUpdateCanvasItemPositions`** — 纯本地更新，不调用API，一次 `set()` 更新所有位置
```typescript
batchUpdateCanvasItemPositions: (updates: { id: string; x: number; y: number }[]) => {
  set((s) => ({
    canvasItems: s.canvasItems.map((item) => {
      const update = updates.find(u => u.id === item.id);
      if (update) return { ...item, positionX: update.x, positionY: update.y };
      return item;
    }),
  }));
},
```

2. **`syncCanvasItemPositions`** — 批量同步到服务端
```typescript
syncCanvasItemPositions: async (updates: { id: string; x: number; y: number }[]) => {
  try {
    for (const update of updates) {
      await api.board.canvas.updatePosition(update.id, update.x, update.y);
    }
  } catch (error) {
    console.error('同步画布项位置失败:', error);
  }
},
```

同时需要在接口定义中声明这两个方法。

#### 步骤2：在 CanvasView.tsx 中添加拖拽起始位置ref

```typescript
const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
const dragStartCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
```

- `dragStartPositionsRef`：记录拖拽开始时所有选中项的位置
- `dragStartCanvasPosRef`：记录拖拽开始时鼠标的画布坐标（用于计算总增量）

#### 步骤3：修改 handleNodeDragStart

在拖拽开始时，记录所有选中项的起始位置和鼠标画布坐标：

```typescript
// 在 setDraggingItemId / setDragOffset 之后添加：
const currentSelectedIds = selectedCanvasItemIds.includes(item.id)
  ? selectedCanvasItemIds
  : [item.id];

const positionsMap = new Map<string, { x: number; y: number }>();
for (const id of currentSelectedIds) {
  const ci = canvasItems.find(i => i.id === id);
  if (ci) positionsMap.set(id, { x: ci.positionX, y: ci.positionY });
}
dragStartPositionsRef.current = positionsMap;
dragStartCanvasPosRef.current = { x: canvasPos.x, y: canvasPos.y };
```

#### 步骤4：修改 handleMouseMove 中的拖拽逻辑

替换当前的拖拽位置更新逻辑：

```typescript
if (draggingItemId) {
  const canvasPos = screenToCanvas(e.clientX, e.clientY);

  if (dragStartPositionsRef.current.size > 0 && dragStartCanvasPosRef.current) {
    // 基于起始位置 + 总增量计算，避免依赖过时状态
    const totalDx = canvasPos.x - dragStartCanvasPosRef.current.x;
    const totalDy = canvasPos.y - dragStartCanvasPosRef.current.y;

    const updates: { id: string; x: number; y: number }[] = [];
    dragStartPositionsRef.current.forEach((startPos, id) => {
      updates.push({
        id,
        x: Math.round(startPos.x + totalDx),
        y: Math.round(startPos.y + totalDy),
      });
    });
    batchUpdateCanvasItemPositions(updates);
  } else {
    // 降级：单选拖拽使用旧逻辑（但也不调API）
    const x = canvasPos.x - dragOffset.x;
    const y = canvasPos.y - dragOffset.y;
    batchUpdateCanvasItemPositions([{ id: draggingItemId, x: Math.round(x), y: Math.round(y) }]);
  }
}
```

关键改进：
- **基于起始位置 + 总增量**：每次mousemove都从起始位置重新计算，不依赖store中的当前位置，彻底消除抖动
- **使用 `batchUpdateCanvasItemPositions`**：一次 `set()` 更新所有位置，只有一次重渲染
- **不调用API**：拖拽过程中零API调用

#### 步骤5：修改 handleMouseUp

在拖拽结束时，批量同步到服务端：

```typescript
if (draggingItemId) {
  // 批量同步位置到服务端
  if (dragStartPositionsRef.current.size > 0) {
    const updates: { id: string; x: number; y: number }[] = [];
    // 从当前store中读取最终位置
    const currentItems = useBoardStore.getState().canvasItems;
    dragStartPositionsRef.current.forEach((_, id) => {
      const item = currentItems.find(i => i.id === id);
      if (item) {
        updates.push({ id, x: item.positionX, y: item.positionY });
      }
    });
    syncCanvasItemPositions(updates);
  }
  // 清除ref
  dragStartPositionsRef.current = new Map();
  dragStartCanvasPosRef.current = null;

  // ... 原有的 setDraggingItemId(null) 等逻辑保持不变
}
```

#### 步骤6：单选拖拽也走优化路径

单选拖拽同样受益于"本地更新+延迟同步"策略。步骤4中的降级逻辑已覆盖单选场景，但可以进一步优化：在 `handleNodeDragStart` 中，即使是单选也记录起始位置到ref中，这样步骤4中的主路径可以统一处理单选和多选。

修改步骤3中的代码，让 `dragStartPositionsRef` 始终记录当前拖拽项的位置（无论单选还是多选）。

#### 步骤7：更新 handleMouseMove 的依赖数组

将 `updateCanvasItemPosition` 替换为 `batchUpdateCanvasItemPositions`，移除不再需要的依赖。

## 预期效果

- 拖拽过程中零API调用，帧率大幅提升
- 基于起始位置计算，彻底消除抖动
- 一次 `set()` 更新所有位置，只有一次重渲染
- 拖拽结束后批量同步，数据一致性有保障

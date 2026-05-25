# 画布优化计划（三项）

## 问题 1：创意卡片添加位置堆叠

### 现状分析

当前添加创意卡片的位置逻辑：
- **从侧边栏拖拽**：使用鼠标位置，不会堆叠 ✅
- **从 Picker 选择器添加**：使用画布视口中心点，多次添加会堆叠 ❌
- **创建创意链便签**：硬编码 `(150, 100)`，每次都堆叠在同一位置 ❌
- **从思维导图子树发送**：使用原节点位置或随机位置，可能堆叠 ❌

### 修改方案

**核心思路**：在添加卡片时，检测新位置是否与已有卡片重叠，如果重叠则自动偏移。

**文件**：`CanvasView.tsx`

1. 新增一个辅助函数 `findNonOverlappingPosition`，接收期望位置 (x, y)，检测与已有 `canvasItems` 的重叠，返回不重叠的位置：

```typescript
const findNonOverlappingPosition = useCallback((x: number, y: number, excludeId?: string) => {
  const OFFSET_STEP = 30;
  let newX = x;
  let newY = y;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    const overlapping = canvasItems.some(item => {
      if (excludeId && item.id === excludeId) return false;
      const itemW = item.width || CARD_MIN_WIDTH;
      const itemH = item.height || CARD_MIN_HEIGHT;
      return Math.abs(newX - item.positionX) < itemW * 0.5 &&
             Math.abs(newY - item.positionY) < itemH * 0.5;
    });
    if (!overlapping) break;
    newX += OFFSET_STEP;
    newY += OFFSET_STEP;
    attempts++;
  }
  return { x: newX, y: newY };
}, [canvasItems]);
```

2. 修改 `handlePickerSelect`（第 2065-2072 行），使用 `findNonOverlappingPosition` 计算位置

3. 修改 `createChainAndSticky` 调用处（第 2264-2268 行），使用画布视口中心 + `findNonOverlappingPosition`

4. 修改 `sendSubtreeToCanvas`（boardStore.ts 第 631-648 行），为每个节点使用偏移位置

---

## 问题 2：创意卡片图层层级固定

### 现状分析

当前 z-index 策略：
- 普通卡片：z-index = 10
- 选中卡片：z-index = 50
- 拖拽中卡片：z-index = 100

**问题**：点击卡片不会将其"置顶"。两张普通卡片的层叠顺序完全取决于 `canvasItems` 数组的插入顺序。

### 修改方案

**核心思路**：点击卡片时，将其移到 `canvasItems` 数组末尾（即渲染在最上层），同时保持 z-index 分层策略不变。

**文件**：`CanvasView.tsx` + `boardStore.ts`

1. 在 `boardStore.ts` 中添加一个 `bringCanvasItemToFront` 方法：

```typescript
bringCanvasItemToFront: (itemId: string) => {
  set((s) => {
    const item = s.canvasItems.find(i => i.id === itemId);
    if (!item) return s;
    const others = s.canvasItems.filter(i => i.id !== itemId);
    return { canvasItems: [...others, item] };
  });
},
```

2. 在 `CanvasView.tsx` 的 `handleNodeClick`（第 1757 行）中，调用 `bringCanvasItemToFront(item.id)`

3. 在 `handleNodeDragStart`（第 1710 行）中，也调用 `bringCanvasItemToFront(item.id)`

这样点击或拖拽卡片时，该卡片会自动置顶。

---

## 问题 3：连线控制点拖拽问题

### 现状分析

两个子问题：

**子问题 A：控制点"黏"在鼠标上**

当前控制点拖拽逻辑（第 1613-1623 行）在 `mousemove` 中直接更新控制点坐标到鼠标位置。这意味着只要 `draggingControlPoint` 不为 null，鼠标移动就会拖拽控制点。

问题在于：`mouseup` 事件可能没有被正确捕获（例如鼠标在 SVG 外释放），导致 `draggingControlPoint` 没有被清空，控制点就"黏"在鼠标上了。

**子问题 B：pointer 模式下点击控制点误触发卡片编辑**

当前控制点的 `onMouseDown`（第 2630-2651 行）没有检查 `canvasToolMode`，所以在 pointer 模式下点击控制点会开始拖拽控制点。但同时，pointer 模式下点击卡片会触发编辑（双击编辑），如果控制点在卡片上方，点击控制点可能会同时触发卡片的编辑。

### 修改方案

**子问题 A：修复控制点"黏"在鼠标上**

1. 在 `handleMouseUp` 中确保 `draggingControlPoint` 被清空（已有，第 1677-1679 行）
2. 在 `handleMouseLeave`（画布容器的鼠标离开事件）中也清空 `draggingControlPoint`
3. 添加 `window` 级别的 `mouseup` 事件监听，确保鼠标在画布外释放时也能结束拖拽

**子问题 B：pointer 模式下点击控制点不误触发卡片编辑**

1. 在控制点的 `onMouseDown` 中，除了 `e.stopPropagation()` 外，确保事件不会冒泡到卡片层
2. 在卡片的 `onMouseDown`（`handleNodeDragStart`）中，检查 `draggingControlPoint` 是否正在拖拽，如果是则忽略卡片的点击

**文件**：`CanvasView.tsx`

1. 在画布容器的 `onMouseLeave` 中添加清空 `draggingControlPoint` 的逻辑

2. 添加 `useEffect` 监听 `window` 的 `mouseup` 事件，确保在画布外释放鼠标时也能结束拖拽：

```typescript
useEffect(() => {
  const handleWindowMouseUp = () => {
    if (draggingControlPoint) {
      setDraggingControlPoint(null);
    }
  };
  window.addEventListener('mouseup', handleWindowMouseUp);
  return () => window.removeEventListener('mouseup', handleWindowMouseUp);
}, [draggingControlPoint]);
```

3. 在 `handleNodeDragStart` 中添加检查，如果正在拖拽控制点则忽略：

```typescript
if (draggingControlPoint) return;
```

## 预期效果

1. 新添加的卡片不会堆叠在同一位置，会自动偏移到不重叠的位置
2. 点击或拖拽卡片时，该卡片自动置顶
3. 连线控制点不会"黏"在鼠标上，pointer 模式下点击控制点不会误触发卡片编辑

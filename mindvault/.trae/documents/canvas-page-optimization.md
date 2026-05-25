# 画布页面功能优化计划

## 概述

6 项画布页面功能优化，涉及卡片缩放、视频播放器、连接节点、线控制点、数据持久化。

***

## 需求 1：图片卡片边缘等比缩放

### 现状

* 图片卡片使用 `width: fit-content`，由媒体自然尺寸决定大小

* 加载后通过 `measureAndUpdateCard` 自动测量并持久化尺寸

* 抓手模式下（任意点击卡片某处）拖拽卡片会移动位置，**但是会误触发缩放功能**

* 之前移除了 resize 手柄

### 目标

* 在抓手模式下，鼠标悬浮在图片卡片**边缘区域**时，显示对应的缩放光标

* 拖拽边缘时才能触发并进行**等比缩放**：

  * 上下边缘 → 纵向等比缩放

  * 左右边缘 → 横向等比缩放

  * 四角 → 双向等比缩放

* 卡片除边缘外其他区域拖拽仍为移动

### 实现步骤

1. **定义边缘检测区域**：在卡片容器上添加 `onMouseMove` 事件，计算鼠标距四条边的距离，设定 4px 的边缘触发区域
2. **动态光标样式**：根据鼠标位置设置对应光标（`n-resize`/`s-resize`/`e-resize`/`w-resize`/`ne-resize`/`nw-resize`/`se-resize`/`sw-resize`）
3. **缩放拖拽逻辑**：在 `handleMouseDown` 中判断是否在边缘区域，如果是则进入缩放模式而非移动模式
4. **等比缩放计算**：

   * 拖拽上/下边：以高度变化为主，宽度按原始宽高比等比调整

   * 拖拽左/右边：以宽度变化为主，高度按原始宽高比等比调整

   * 拖拽角：以对角线方向拖拽距离为主，宽高按原始比例等比调整
5. **最小尺寸限制**：缩放下限为 `CARD_MIN_WIDTH × CARD_MIN_HEIGHT`（240×140px），这是所有卡片的通用最小尺寸，不是图片/视频的原尺寸。用户可以将图片/视频缩小到比原尺寸小得多，但不能小于 240×140px
6. **实时更新**：缩放过程中实时更新 `item.width` 和 `item.height`，拖拽结束时调用 `updateCanvasItemSize` 持久化

### 需要修改的文件

| 文件                 | 修改内容                 |
| ------------------ | -------------------- |
| `CanvasView.tsx`   | 添加边缘检测、缩放光标、缩放拖拽逻辑   |
| `CustomCursor.tsx` | 已支持 resize 光标类型，无需修改 |

***

## 需求 2：视频卡片等比缩放

### 现状

* 视频卡片同样使用 `width: fit-content`，由视频自然尺寸决定大小

* 视频播放器是原生 `<video controls muted>` 标签

### 目标

* 与需求 1 相同的边缘缩放交互

* 缩放作用于视频播放器尺寸（即改变 `<video>` 的显示尺寸）

### 实现步骤

1. **复用需求 1 的边缘检测和缩放逻辑**：图片和视频卡片共享同一套缩放机制
2. **视频播放器尺寸跟随**：缩放时更新卡片容器的 `width`/`height`，视频播放器通过 CSS `width: 100%` 自动跟随
3. **视频标签样式调整**：将 `<video>` 的 `style` 从 `display: block` 改为 `display: block; width: 100%`，使其跟随容器尺寸

### 需要修改的文件

| 文件               | 修改内容            |
| ---------------- | --------------- |
| `CanvasView.tsx` | 视频标签样式调整，复用缩放逻辑 |

***

## 需求 3：连接节点活动范围扩展

### 现状

* `ConnectorPosition = { side: 'left'|'right'|'top'|'bottom', offset: 0~1 }`

* 连接点只能依附在卡片边缘，`offset` 是沿边缘的 0\~1 比例

* `calculateConnectorPosition` 根据边和偏移计算绝对坐标

* 连接点拖拽时通过 `calculateConnectorFromMouse` 自动吸附到最近的边

### 目标

* 连接点生成范围从"边缘"扩展到"整个卡片面积"

* 连接点只能在所属卡片范围内活动，不能甩到其他卡片上

* 卡片缩小时，如果边缘触碰到节点，节点被"扫动"跟随移动，不脱离卡片

### 实现步骤

1. **扩展 ConnectorPosition 类型**：增加 `positionX` 和 `positionY` 字段（相对于卡片的偏移），使节点可以在卡片内部任意位置

   ```typescript
   export interface ConnectorPosition {
     side: ConnectorSide;
     offset: number;
     relativeX?: number;  // 相对卡片左上角的 X 偏移（像素）
     relativeY?: number;  // 相对卡片左上角的 Y 偏移（像素）
   }
   ```
2. **修改** **`calculateConnectorPosition`**：优先使用 `relativeX/relativeY`，如果没有则回退到边+偏移计算
3. **修改连接点创建逻辑**：创建连接时，将鼠标位置转换为 `relativeX/relativeY`（相对于卡片左上角）
4. **修改连接点拖拽逻辑**：拖拽时更新 `relativeX/relativeY`，并约束在卡片范围内（0 ≤ x ≤ width, 0 ≤ y ≤ height）
5. **防止跨卡片**：拖拽时检测目标位置是否仍在当前卡片范围内，如果超出则 clamp 到边界
6. **扫动逻辑**：在卡片缩放（需求 1/2）时，检查所有连接点的 `relativeX/relativeY`，如果超出新的卡片边界，则 clamp 到边界并更新

### 需要修改的文件

| 文件               | 修改内容                                         |
| ---------------- | -------------------------------------------- |
| `types.ts`       | `ConnectorPosition` 增加 `relativeX/relativeY` |
| `CanvasView.tsx` | 连接点创建、拖拽、渲染、扫动逻辑                             |
| `boardStore.ts`  | 连接点更新方法适配                                    |

***

## 需求 4：视频循环播放与进度冻结

### 现状

* 视频使用原生 `<video controls muted>` 标签

* 没有循环播放功能

* 离开页面后视频停止，回来后从头播放

### 目标

* 视频播放器增加"循环播放"按钮

* 开启循环后：离开页面时冻结播放进度，回来时从冻结点继续循环播放

* 关闭循环后恢复正常行为

### 实现步骤

1. **数据持久化**：在 `BoardCanvasItem` 中增加 `videoLoopMode` 和 `videoFrozenTime` 字段

   ```typescript
   // 在 board_canvas_items 表增加
   video_loop_mode INTEGER DEFAULT 0,  -- 0=正常, 1=循环
   video_frozen_time REAL DEFAULT 0    -- 冻结的播放时间（秒）
   ```
2. **自定义视频控制栏**：替换原生 `controls`，使用自定义控制栏，包含：播放/暂停、进度条、音量、循环按钮、时间显示
3. **循环播放实现**：监听 `video` 的 `ended` 事件，如果 `videoLoopMode` 为 1 则 `video.currentTime = 0` 并播放
4. **进度冻结**：

   * 页面卸载前（`useEffect` cleanup 或 `beforeunload`）：如果循环模式开启，保存 `video.currentTime` 到 `videoFrozenTime`

   * 页面加载时：如果 `videoFrozenTime > 0`，设置 `video.currentTime = videoFrozenTime` 并自动播放
5. **循环按钮 UI**：在视频控制栏右侧添加循环图标按钮，开启时高亮显示

### 需要修改的文件

| 文件               | 修改内容                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `schema.sql`     | `board_canvas_items` 表增加 `video_loop_mode` 和 `video_frozen_time` 列 |
| `types.ts`       | `BoardCanvasItem` 增加对应字段                                           |
| `board.ts` (IPC) | 更新 item 的 CRUD 适配新字段                                               |
| `boardStore.ts`  | 更新 store 方法适配新字段                                                   |
| `CanvasView.tsx` | 自定义视频控制栏、循环逻辑、进度冻结/恢复                                              |

***

## 需求 5：连线控制点（贝塞尔曲线编辑）

### 现状

* 连线使用固定贝塞尔曲线：`getEdgePath` 生成 `M ... C ...` 路径

* 控制点偏移量固定为 `Math.max(50, max(dx,dy) * 0.4)`

* 连线不可编辑

### 目标

* Ctrl + 点击连线上的某点 → 创建控制点

* 拖拽控制点 → 调整连线的弯曲程度

* 右键控制点 → 弹出菜单删除

* 删除后线的弯曲变化不回退

### 实现步骤

1. **扩展数据类型**：`BoardCanvasEdge` 增加 `controlPoints` 字段

   ```typescript
   export interface EdgeControlPoint {
     id: string;
     x: number;  // 画布绝对坐标
     y: number;
   }
   // BoardCanvasEdge 增加:
   controlPoints?: EdgeControlPoint[] | null;
   ```
2. **数据库扩展**：`board_canvas_edges` 表增加 `control_points TEXT` 列（JSON 存储）
3. **修改** **`getEdgePath`**：接受控制点参数，生成多段贝塞尔曲线

   * 无控制点：保持原有逻辑

   * 有控制点：将连线分段，每段用贝塞尔曲线连接（源→CP1→CP2→...→目标）
4. **Ctrl + 点击连线检测**：

   * 在 SVG 层监听 `click` 事件，检查 `e.ctrlKey`

   * 计算点击位置到连线的最近距离，如果在 10px 内则创建控制点
5. **控制点渲染**：在 SVG 层渲染控制点为小圆圈，可拖拽
6. **控制点拖拽**：拖拽时更新控制点坐标，重新计算连线路径
7. **右键菜单**：右键控制点弹出删除菜单

### 需要修改的文件

| 文件               | 修改内容                                         |
| ---------------- | -------------------------------------------- |
| `schema.sql`     | `board_canvas_edges` 增加 `control_points` 列   |
| `types.ts`       | 增加 `EdgeControlPoint`，`BoardCanvasEdge` 增加字段 |
| `board.ts` (IPC) | edge CRUD 适配 `control_points`                |
| `boardStore.ts`  | 增加 `updateCanvasEdgeControlPoints` 方法        |
| `api.ts`         | 增加对应 API 调用                                  |
| `CanvasView.tsx` | 连线渲染、控制点交互、右键菜单                              |

***

## 需求 6：看板便签数据适配（剩余工作）

### 已完成

* ✅ `CreativeChainSnapshotItem` 类型已增加 `videoLoopMode`、`videoFrozenTime`
* ✅ `CreativeChainSnapshotEdge` 类型已增加 `controlPoints`
* ✅ `ConnectorPosition` 类型已增加 `relativeX`/`relativeY`（通过 `sourceConnector`/`targetConnector` 间接包含）

### 剩余工作

#### 6.1 更新 `handlePackAsChain` 打包逻辑（CanvasView.tsx 第 2148-2165 行）

当前快照构建缺少新字段，需要补充：

```typescript
// items 部分增加：
items: selectedItems.map(item => ({
  creativityId: item.creativityId,
  positionX: item.positionX,
  positionY: item.positionY,
  width: item.width,
  height: item.height,
  videoLoopMode: item.videoLoopMode,     // 新增
  videoFrozenTime: item.videoFrozenTime,  // 新增
})),

// edges 部分增加：
edges: relevantEdges.map(edge => ({
  sourceId: itemIdToCreativityId[edge.sourceItemId] || edge.sourceItemId,
  targetId: itemIdToCreativityId[edge.targetItemId] || edge.targetItemId,
  edgeType: edge.edgeType,
  label: edge.label,
  sourceConnector: edge.sourceConnector,
  targetConnector: edge.targetConnector,
  controlPoints: edge.controlPoints,      // 新增
  sourceIdx: itemIdToIndex[edge.sourceItemId],
  targetIdx: itemIdToIndex[edge.targetItemId],
})),
```

#### 6.2 更新 `CreativeChainSnapshotViewer.tsx`

**6.2.1 更新 `LocalCanvasItem` 接口**（第 86-93 行）

```typescript
interface LocalCanvasItem {
  id: string;
  creativityId: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  videoLoopMode?: number;     // 新增
  videoFrozenTime?: number;   // 新增
}
```

**6.2.2 更新 `LocalCanvasEdge` 接口**（第 95-103 行）

```typescript
interface LocalCanvasEdge {
  id: string;
  sourceItemId: string;
  targetItemId: string;
  edgeType: string;
  label: string | null;
  sourceConnector: ConnectorPosition | null;
  targetConnector: ConnectorPosition | null;
  controlPoints?: EdgeControlPoint[] | null;  // 新增
}
```

**6.2.3 更新 `calculateConnectorPosition` 函数**（第 48-67 行）

当前只使用 `side`/`offset`，需要增加 `relativeX`/`relativeY` 支持：

```typescript
function calculateConnectorPosition(
  itemX: number,
  itemY: number,
  itemWidth: number,
  itemHeight: number,
  connector?: ConnectorPosition | null,
  defaultSide: ConnectorSide = 'right'
): { x: number; y: number } {
  if (!connector) {
    // 默认位置逻辑（使用 itemWidth/itemHeight 替代 CARD_WIDTH/CARD_HEIGHT）
    ...
  }
  // 优先使用 relativeX/relativeY
  if (connector.relativeX !== undefined && connector.relativeY !== undefined) {
    return { x: itemX + connector.relativeX, y: itemY + connector.relativeY };
  }
  // 回退到 side/offset 逻辑（使用 itemWidth/itemHeight 替代 CARD_WIDTH/CARD_HEIGHT）
  ...
}
```

**6.2.4 更新快照还原逻辑**（第 164-209 行）

还原 items 时包含新字段：

```typescript
const restoredItems: LocalCanvasItem[] = snapshot.items.map((item, idx) => ({
  id: `item-${idx}`,
  creativityId: item.creativityId,
  positionX: item.positionX,
  positionY: item.positionY,
  width: item.width || CARD_WIDTH,
  height: item.height || CARD_HEIGHT,
  videoLoopMode: item.videoLoopMode,     // 新增
  videoFrozenTime: item.videoFrozenTime,  // 新增
}));
```

还原 edges 时包含 `controlPoints`：

```typescript
return {
  id: `edge-${idx}`,
  sourceItemId,
  targetItemId,
  edgeType: edge.edgeType,
  label: edge.label || null,
  sourceConnector: edge.sourceConnector || null,
  targetConnector: edge.targetConnector || null,
  controlPoints: edge.controlPoints || null,  // 新增
};
```

**6.2.5 更新 `getEdgePath` 函数**（第 69-79 行）

支持 `controlPoints` 参数，生成多段贝塞尔曲线：

```typescript
function getEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  controlPoints?: EdgeControlPoint[] | null
): string {
  if (!controlPoints || controlPoints.length === 0) {
    // 原有逻辑
    const dx = Math.abs(targetX - sourceX);
    const dy = Math.abs(targetY - sourceY);
    const controlOffset = Math.max(50, Math.max(dx, dy) * 0.4);
    return `M ${sourceX} ${sourceY} C ${sourceX + controlOffset} ${sourceY}, ${targetX - controlOffset} ${targetY}, ${targetX} ${targetY}`;
  }
  // 有控制点：分段贝塞尔曲线
  const points = [{ x: sourceX, y: sourceY }, ...controlPoints.map(cp => ({ x: cp.x, y: cp.y })), { x: targetX, y: targetY }];
  // 每两个相邻点之间生成一段贝塞尔曲线
  let path = `M ${sourceX} ${sourceY}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    const offset = Math.max(30, Math.max(dx, dy) * 0.3);
    if (prev.x < curr.x) {
      path += ` C ${prev.x + offset} ${prev.y}, ${curr.x - offset} ${curr.y}, ${curr.x} ${curr.y}`;
    } else {
      path += ` C ${prev.x - offset} ${prev.y}, ${curr.x + offset} ${curr.y}, ${curr.x} ${curr.y}`;
    }
  }
  return path;
}
```

**6.2.6 更新保存快照逻辑**（第 591-611 行）

保存时包含新字段：

```typescript
const newSnapshot: CreativeChainSnapshot = {
  items: items.map(item => ({
    creativityId: item.creativityId,
    positionX: item.positionX,
    positionY: item.positionY,
    width: item.width,
    height: item.height,
    videoLoopMode: item.videoLoopMode,     // 新增
    videoFrozenTime: item.videoFrozenTime,  // 新增
  })),
  edges: edges.map(edge => ({
    sourceId: itemIdToCreativityId[edge.sourceItemId] || edge.sourceItemId,
    targetId: itemIdToCreativityId[edge.targetItemId] || edge.targetItemId,
    edgeType: edge.edgeType,
    label: edge.label,
    sourceConnector: edge.sourceConnector,
    targetConnector: edge.targetConnector,
    controlPoints: edge.controlPoints,      // 新增
    sourceIdx: itemIdToIndex[edge.sourceItemId],
    targetIdx: itemIdToIndex[edge.targetItemId],
  })),
  canvasOffset: offset,
  canvasScale: scale,
};
```

**6.2.7 更新连线渲染**（第 870-907 行）

渲染连线时传入 `controlPoints`，渲染控制点圆圈：

```typescript
const path = getEdgePath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, edge.controlPoints);

// 在 <g> 内增加控制点渲染
{edge.controlPoints?.map(cp => (
  <circle
    key={cp.id}
    cx={cp.x}
    cy={cp.y}
    r={4}
    fill="white"
    stroke={color}
    strokeWidth={2}
    style={{ pointerEvents: 'all', cursor: 'move' }}
  />
))}
```

**6.2.8 更新卡片渲染**

卡片宽度使用 `item.width` 而非固定 `CARD_WIDTH`，高度使用 `item.height` 而非固定 `CARD_HEIGHT`：

```typescript
style={{
  position: 'absolute',
  left: item.positionX,
  top: item.positionY,
  width: item.width || CARD_WIDTH,    // 替代固定 CARD_WIDTH
  ...
}}
```

**6.2.9 更新 `calculateConnectorFromMouse`**

与 `calculateConnectorPosition` 类似，使用 `item.width`/`item.height` 替代 `CARD_WIDTH`/`CARD_HEIGHT`，并增加 `relativeX`/`relativeY` 输出。

**6.2.10 导入 `EdgeControlPoint` 类型**

在文件头部增加 `EdgeControlPoint` 的导入。

### 需要修改的文件

| 文件                                | 修改内容                                         |
| --------------------------------- | -------------------------------------------- |
| `CanvasView.tsx`                  | `handlePackAsChain` 增加 `videoLoopMode`/`videoFrozenTime`/`controlPoints` |
| `CreativeChainSnapshotViewer.tsx` | 全面适配新字段：接口、还原、保存、渲染、连线计算                   |

### 向后兼容

对于已有便签（没有新字段的快照），所有新字段使用默认值：
- `videoLoopMode` 默认 0（不循环）
- `videoFrozenTime` 默认 0
- `controlPoints` 默认 null
- `relativeX`/`relativeY` 默认 undefined（回退到 side/offset 逻辑）

***

## 实施顺序

按依赖关系排序：

1. **需求 1+2**（图片/视频卡片缩放）— 基础交互，其他需求依赖缩放逻辑
2. **需求 3**（连接节点扩展）— 依赖缩放逻辑的"扫动"功能
3. **需求 4**（视频循环播放）— 独立功能，但需要数据库变更
4. **需求 5**（连线控制点）— 独立功能，但需要数据库变更
5. **需求 6**（便签数据适配）— 最后做，需要汇总所有新字段

需求 1+2 和需求 4 可以并行开发，需求 3 依赖 1+2，需求 5 独立，需求 6 最后。

***

## 数据库变更汇总

```sql
-- board_canvas_items 表
ALTER TABLE board_canvas_items ADD COLUMN video_loop_mode INTEGER DEFAULT 0;
ALTER TABLE board_canvas_items ADD COLUMN video_frozen_time REAL DEFAULT 0;

-- board_canvas_edges 表
ALTER TABLE board_canvas_edges ADD COLUMN control_points TEXT;
```

同时需要在 `schema.sql` 的 CREATE TABLE 语句中加入这些列，确保新安装时也包含。

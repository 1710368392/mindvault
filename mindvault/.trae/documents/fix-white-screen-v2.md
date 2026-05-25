# 修复白屏问题 - 第二轮排查

## 问题

上一轮修复了 HSL 颜色格式问题后，应用仍然白屏。需要进一步排查。

## 深入分析

### 根因 1（最可能）：StatsDashboard 液体动画 `convertToPixel` 崩溃

在 `StatsDashboard.tsx` 的 `requestAnimationFrame` 动画循环中，`chartInst.convertToPixel('grid', ...)` 可能在图表未完全初始化时返回 `null`。访问 `null[0]` 会抛出 `TypeError`，由于在 `rAF` 循环中，错误会不断发生。

```ts
position: [
  chartInst.convertToPixel('grid', [dayIndex + 0.5 + bubbleX * barWidth * 0.3, 0])[0],  // 可能 null!
  chartInst.convertToPixel('grid', [0, total * y])[1],  // 可能 null!
],
```

### 根因 2（可能）：ECharts 不支持 8 位十六进制颜色

`baseColor + 'CC'` 产生 8 位十六进制颜色（如 `#FFB300CC`）。虽然 CSS 规范支持，但 ECharts 内部颜色解析器可能不支持，导致渲染崩溃。

### 根因 3（可能）：`graphic` 元素累积导致内存/渲染问题

每次动画帧都通过 `setOption({ graphic: [...] })` 添加图形元素，但没有指定 `$action: 'replace'` 或 `id`，导致元素不断累积。

### 根因 4（次要）：`isBottom` 未使用变量

`StatsDashboard.tsx` 第 301 行声明了 `isBottom` 但未使用，虽然 `noUnusedLocals: false` 不会导致编译错误，但应清理。

### 根因 5（次要）：`List` 未使用导入

`Header.tsx` 第 11 行导入了 `List` 但不再使用，应清理。

## 修复步骤

### 步骤 1：修复 StatsDashboard 液体动画 - 核心崩溃点

**文件**：`src/renderer/components/dashboard/StatsDashboard.tsx`

1. **替换 8 位十六进制颜色为 `rgba()` 格式**：添加 `hexToRgba` 辅助函数，将 `baseColor + 'CC'` 替换为 `rgba(r, g, b, 0.8)` 格式
2. **为 `convertToPixel` 添加 null 检查**：如果返回 `null`，跳过该气泡的绘制
3. **修复 `graphic` 元素管理**：添加 `$action: 'replace'` 和 `id` 属性，防止元素累积
4. **添加 try-catch 保护**：整个动画循环用 try-catch 包裹，防止单次错误导致整个应用崩溃
5. **清理 `isBottom` 未使用变量**

### 步骤 2：清理 Header.tsx 未使用的 List 导入

**文件**：`src/renderer/components/layout/Header.tsx`

移除 `List` 的导入。

### 步骤 3：验证修复

确认应用能正常启动，不再白屏。

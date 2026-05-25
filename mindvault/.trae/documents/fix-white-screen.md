# 修复白屏问题 - 排查计划

## 问题分析

软件白屏无法进入，最可能的原因是 **渲染层 JavaScript 运行时错误**，导致 React 组件树崩溃。

## 排查结果

### 根因：StatsDashboard 液体动画中颜色格式错误

在 `StatsDashboard.tsx` 的液体动画代码中，使用了 `baseColor + 'CC'` 等方式拼接透明度后缀：

```ts
{ offset: 0.2, color: baseColor + 'CC' },
{ offset: 0.35, color: baseColor + 'AA' },
```

**问题**：`baseColor` 来自 `colors.pieColors[type]`，而 `pieColors` 由 `generateThemePieColors()` 生成，返回的是 **HSL 格式**的颜色字符串，如 `hsl(240, 70%, 50%)`。

拼接后变成 `hsl(240, 70%, 50%)CC` —— 这是**无效的颜色值**，会导致 ECharts 渲染崩溃，进而引发未捕获的 JavaScript 错误，导致整个 React 应用白屏。

而 `TYPE_COLORS` 使用的是十六进制格式（如 `#FFB300`），拼接 `#FFB300CC` 是合法的 8 位十六进制颜色。但当 `pieColors` 覆盖了 `TYPE_COLORS` 时，HSL 格式就会导致问题。

### 次要问题：数据库迁移未生效

`migration.ts` 中新增的 `board_canvas_items` 列迁移（subtype, card_style 等）不会被实际执行，因为主进程入口 `index.ts` 使用的是 `repository.ts` 的 `initDatabase()`，而非 `migration.ts` 的。需要将迁移逻辑同步到 `repository.ts`。

## 修复步骤

### 步骤 1：修复 StatsDashboard 颜色格式问题

在 `StatsDashboard.tsx` 中，将 HSL 颜色转换为十六进制后再拼接透明度后缀，或者使用 `rgba()` 格式替代。

**方案**：添加一个 `toHexColor` 辅助函数，确保 `baseColor` 始终为十六进制格式后再拼接透明度后缀。

**涉及文件**：
- `src/renderer/components/dashboard/StatsDashboard.tsx`

### 步骤 2：将数据库迁移同步到 repository.ts

将 `migration.ts` 中新增的 `board_canvas_items` 列迁移逻辑复制到 `repository.ts` 的 `initDatabase()` 函数中。

**涉及文件**：
- `src/main/db/repository.ts`

### 步骤 3：验证修复

确认应用能正常启动，不再白屏。

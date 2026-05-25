# 自定义动态光标稳定性优化方案

## 现状分析

当前自定义光标系统采用 **Canvas 覆盖层 + CSS 隐藏系统光标** 的方案：

1. `custom-cursor.css` 通过 `cursor: none !important` 隐藏所有系统光标
2. `CustomCursor.tsx` 使用 Canvas 绘制 PNG 帧动画，通过 `requestAnimationFrame` 循环渲染
3. `detectCursorType()` 在每次 `mousemove` 时调用 `getComputedStyle()` 判断光标类型
4. 鼠标位置通过 `transform: translate()` 跟随

### 当前方案的稳定性问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| **光标完全消失风险** | 🔴 严重 | CSS 隐藏了系统光标，如果 Canvas 渲染出错或图片加载失败，用户将没有任何光标可用 |
| **帧资源缺失** | 🔴 严重 | `Person/` 只有 8 帧、`Diagonal2/` 缺 frame_009、`Handwriting/` 缺 frame_011 且无 manifest，导致 `loadCursorImages` 中 `results.every(r => r)` 返回 false，整个光标类型不可用 |
| **性能开销大** | 🟡 中等 | `requestAnimationFrame` 每帧都执行 Canvas 渲染（clearRect + drawImage × 2 + globalAlpha 切换），即使鼠标静止也在运行 |
| **getComputedStyle 开销** | 🟡 中等 | 每次 mousemove 都调用 `getComputedStyle()`，这是一个强制同步布局操作，在快速移动时可能造成卡顿 |
| **无 DPI 适配** | 🟡 中等 | 固定 32×32 像素，在高 DPI 屏幕上会显得模糊/过小 |
| **帧插值闪烁** | 🟢 轻微 | alpha 混合插值在帧切换时可能出现闪烁 |

---

## 方案对比

### 方案 A：CSS `cursor: url()` + 定时器帧切换（推荐 ✅）

**原理**：将 PNG 帧预转换为 `.cur` 文件，通过 CSS `cursor: url()` 设置光标，用 JS 定时器切换不同帧的 URL 实现动画。

**优点**：
- ✅ 光标由浏览器原生渲染，最稳定，不会因 JS 错误而消失
- ✅ 无 Canvas 渲染开销，性能最好
- ✅ 自动适配 DPI（浏览器处理光标缩放）
- ✅ 即使 JS 定时器出错，CSS cursor 仍显示最后一帧（不会消失）
- ✅ 无需 `cursor: none !important`，从根本上消除光标消失风险

**缺点**：
- ⚠️ CSS `cursor: url()` 切换可能有轻微延迟（浏览器需要加载/缓存 .cur 文件）
- ⚠️ 需要预生成 .cur 文件（可复用现有提取脚本）
- ⚠️ 部分浏览器对 `cursor: url()` 的尺寸有限制（通常 128×128 以内，32×32 完全没问题）

**实现思路**：
1. 修改 `extract-cursor-frames.js` 脚本，额外输出 `.cur` 格式的帧文件
2. 新建 `CustomCursorManager` 类，在 JS 中用定时器按帧率切换 CSS `cursor: url()`
3. 在 `mousemove` 中检测光标类型，切换到对应的光标帧序列
4. 移除 Canvas 覆盖层和 `cursor: none !important`

---

### 方案 B：优化现有 Canvas 方案 + CSS 兜底

**原理**：保留 Canvas 动画系统，但增加 CSS `cursor: url()` 作为兜底层，并优化性能。

**优点**：
- ✅ 保留现有动画效果（alpha 混合插值更平滑）
- ✅ 有 CSS 兜底，光标不会完全消失
- ✅ 改动较小，风险低

**缺点**：
- ⚠️ 仍需 Canvas 渲染，性能开销未根本解决
- ⚠️ 两套系统并存，维护复杂
- ⚠️ Canvas 和 CSS cursor 可能出现视觉冲突（两层光标）

---

### 方案 C：Electron 原生光标 API

**原理**：通过 Electron 主进程设置系统级光标。

**结论**：❌ 不可行。Electron 没有提供 `setCursor()` 等 API，唯一的方式仍是渲染进程的 CSS `cursor: url()`。

---

## 推荐方案：方案 A — CSS `cursor: url()` + 定时器帧切换

### 实现步骤

#### 第 1 步：生成 .cur 帧文件

修改 `scripts/extract-cursor-frames.js`，在提取 PNG 帧的同时，将每帧也输出为 `.cur` 格式：

- 输出目录：`public/cursors-cur/{CursorName}/frame_000.cur` ~ `frame_011.cur`
- `.cur` 文件格式：ICO 文件头 + 单张 PNG 数据（现代 .cur 格式支持内嵌 PNG）
- 从 manifest.json 读取 hotspot 坐标写入 .cur 头部
- 处理缺失帧：如果某帧 PNG 不存在，复制前一帧（或首帧）作为占位

#### 第 2 步：创建 CustomCursorManager 类

新建 `src/renderer/utils/CustomCursorManager.ts`：

```typescript
class CustomCursorManager {
  private cursorType: CursorType = 'default';
  private frameIndex: number = 0;
  private timer: number | null = null;
  private enabled: boolean = false;
  private frameUrls: Map<string, string[]> = new Map(); // 缓存所有帧 URL

  // 初始化：预加载所有 .cur 帧 URL
  async init(): Promise<void>;

  // 启动动画定时器
  start(): void;

  // 停止动画定时器
  stop(): void;

  // 切换光标类型（由 mousemove 触发）
  setCursorType(type: CursorType): void;

  // 更新 CSS cursor 属性
  private updateCursor(): void;

  // 销毁
  destroy(): void;
}
```

关键设计：
- **帧 URL 预构建**：初始化时构建所有光标类型的帧 URL 数组，无需运行时计算
- **定时器驱动动画**：使用 `setInterval` 按 manifest.json 中的 speed 间隔切换帧（约 60ms/帧）
- **CSS cursor 切换**：通过修改 `document.documentElement.style.cursor` 实现帧切换
- **优雅降级**：如果 .cur 文件加载失败，回退到系统默认光标（而非 `cursor: none`）

#### 第 3 步：优化光标类型检测

改进 `detectCursorType` 函数：

- **缓存机制**：记录上次检测的元素和结果，相同元素不重复计算
- **事件委托优化**：只在 `mouseover`/`mouseout` 时检测（而非每次 `mousemove`）
- **CSS 类标记**：为常用交互元素添加 `data-cursor-type` 属性，优先读取，避免 `getComputedStyle`

#### 第 4 步：修改 custom-cursor.css

```css
/* 移除 cursor: none !important */
/* 改为由 JS 动态设置 cursor: url() */
html[data-custom-cursor="true"] {
  /* 不再隐藏系统光标，而是由 JS 设置自定义光标 URL */
}
```

#### 第 5 步：修改 CustomCursor.tsx 组件

将组件改为使用 `CustomCursorManager`：

- 移除 Canvas 渲染逻辑
- 移除 `requestAnimationFrame` 循环
- 保留事件监听（mousemove/mousedown/mouseup）
- 使用 `CustomCursorManager` 实例管理光标切换

#### 第 6 步：处理边界情况

- **窗口失焦**：暂停动画定时器，恢复默认光标
- **右键菜单**：确保自定义光标不影响上下文菜单
- **拖拽操作**：正确处理 grab/grabbing 切换
- **iframe**：确保光标在 iframe 边界正确切换
- **高 DPI**：.cur 文件中的 PNG 数据保持原始分辨率，浏览器自动缩放

#### 第 7 步：清理旧代码

- 移除 Canvas 相关代码
- 移除 `imageStore`、`loadCursorImages` 等
- 可选：保留 PNG 帧目录作为备份，或完全删除

---

### 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| CSS cursor: url() 切换闪烁 | 中 | 低 | 预加载所有 .cur 文件到浏览器缓存；使用 data URI 替代文件 URL |
| .cur 文件体积过大 | 低 | 低 | 使用 PNG 内嵌的 .cur 格式，每帧约 1-2KB |
| 某些光标类型帧缺失 | 中 | 中 | 缺失帧用首帧占位，确保不会加载失败 |
| 浏览器 cursor: url() 兼容性 | 低 | 高 | Electron/Chromium 完全支持，无兼容问题 |

---

### 备选优化：如果方案 A 动画效果不理想

如果 CSS cursor 切换的动画流畅度不够，可以采用 **方案 A+ 混合方案**：

1. **静态光标**：始终通过 CSS `cursor: url()` 显示当前帧（保证光标永远可见）
2. **动画增强**：在 CSS cursor 之上叠加一个轻量 Canvas 层，仅用于帧间过渡效果
3. **Canvas 层自动隐藏**：如果 Canvas 渲染出错，CSS cursor 仍然可见

这样既保证了稳定性（CSS 兜底），又保留了平滑的动画效果。

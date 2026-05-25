# 自定义指针功能修复计划

## 问题根因

当前自定义指针功能完全不工作的根本原因是：**CSS `cursor: url()` 不支持 `.ani` 格式文件**。

### 为什么 CSS 不支持动态光标？

这是 **W3C CSS 规范的设计限制**：
- CSS `cursor: url()` 只支持静态图像格式（`.cur`、`.png`、`.svg` 等）
- 即使传入 GIF 动图也只显示第一帧，不会播放动画
- `.ani` 是 Windows 专有格式，历史上只有 IE 支持，现代浏览器均不支持

### 你的思路完全正确

光标样式不参与主题变化，所以**完全可以绕过 CSS `cursor` 属性**，用 JavaScript + DOM 的方式实现动态光标。

## 方案：JS DOM 模拟动态光标

### 核心原理

1. **隐藏系统光标**：在应用窗口内设置 `cursor: none`
2. **创建 DOM 元素模拟光标**：一个 `<div>` 元素，用 CSS 绘制光标外观，支持 CSS 动画
3. **JavaScript 跟踪鼠标**：监听 `mousemove` 事件，实时更新模拟光标位置
4. **上下文感知**：根据悬停的元素类型（按钮、文本框、链接等）切换光标样式

### 为什么这个方案可行

- ✅ 支持**动画效果**：DOM 元素可以用 CSS `@keyframes`、`transition` 实现动画
- ✅ 不依赖 CSS `cursor` 属性：完全绕过 `.ani` 格式限制
- ✅ 不参与主题系统：光标组件独立于主题切换逻辑
- ✅ Electron 桌面应用场景：不需要考虑移动端触摸
- ✅ 已有成熟实践：大量网站和库使用此方案

### 光标样式设计

用 CSS 绘制 Aemeath 风格的光标，而非加载图片文件：

| 场景 | 光标样式 | 实现方式 |
|------|----------|----------|
| 默认 | 箭头指针 | CSS 绘制的三角形 + 矩形组合 |
| 悬停链接/按钮 | 手型指针 | CSS 绘制的手指形状 |
| 文本输入 | I 型光标 | CSS 绘制的竖线 |
| 拖拽 | 十字箭头 | CSS 绘制的四向箭头 |
| 禁用 | 禁止符号 | CSS 绘制的圆圈 + 斜线 |
| 等待 | 沙漏/旋转 | CSS 动画旋转效果 |
| 调整大小 | 双向箭头 | CSS 绘制的方向箭头 |

## 实施步骤

### 步骤 1：创建 CustomCursor 组件

创建 `src/renderer/components/common/CustomCursor.tsx`：

- 渲染一个 `position: fixed` 的 `<div>` 作为光标容器
- 内部根据当前光标类型渲染不同的 CSS 形状
- 使用 `requestAnimationFrame` 跟踪鼠标位置（比 `mousemove` 更流畅）
- 检测悬停元素的类型，自动切换光标样式
- 添加 CSS 动画效果（如默认光标的微妙呼吸、等待光标的旋转等）

### 步骤 2：修改 custom-cursor.css

- 移除所有 `.ani` 文件引用
- 改为 `cursor: none !important`（隐藏系统光标）
- 仅在 `html[data-custom-cursor="true"]` 时生效

### 步骤 3：在 App.tsx 中挂载 CustomCursor

- 在 `App` 组件中引入 `CustomCursor`
- 根据 `settings.customCursor` 控制显示/隐藏

### 步骤 4：清理旧的 .ani 文件

- 删除 `src/renderer/public/cursors/` 目录下的 `.ani` 文件
- 或保留但不引用（不影响功能）

## 需要修改/新增的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/renderer/components/common/CustomCursor.tsx` | 新增 | 自定义光标组件 |
| `src/renderer/styles/components/custom-cursor.css` | 修改 | 改为 `cursor: none`，移除 .ani 引用 |
| `src/renderer/App.tsx` | 修改 | 挂载 CustomCursor 组件 |

## 性能考虑

- 使用 `requestAnimationFrame` 而非 `mousemove` 直接更新位置，避免卡顿
- 光标元素设置 `pointer-events: none`，不干扰正常交互
- 光标元素设置 `will-change: transform`，启用 GPU 加速
- 组件卸载时清理事件监听

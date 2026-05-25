# 自定义光标打包后消失修复计划

## 根因分析

**核心问题：光标帧图片路径在 `file://` 协议下无法解析**

### 故障链条

1. `main.tsx` 启动时立即设置 `data-custom-cursor="true"`
2. CSS 规则 `html[data-custom-cursor="true"] * { cursor: none !important }` 隐藏所有系统光标
3. `CustomCursor.tsx` 通过 `/cursors-frames/${name}/frame_xxx.png` 加载图片
4. **开发模式**：Vite dev server 提供 `http://localhost:5173/cursors-frames/...`，绝对路径可以正常解析 ✅
5. **打包模式**：Electron 通过 `loadFile()` 以 `file://` 协议加载 HTML，绝对路径 `/cursors-frames/...` 被解析为文件系统根目录（`file:///C:/cursors-frames/...`），该路径不存在 ❌
6. 所有图片加载失败，Canvas 始终透明，系统光标已被 CSS 隐藏 → **光标完全消失**

### 关键代码

`CustomCursor.tsx` 第 60 行：
```typescript
// 当前（绝对路径，打包后失效）
img.src = `/cursors-frames/${name}/frame_${String(i).padStart(3, '0')}.png`;
```

`vite.config.ts` 中 `base: './'`，但 `base` 只影响 Vite 处理的 HTML/CSS 资源引用，不影响 JS 运行时动态拼接的路径。

## 修复方案

### 修复 1：图片路径改用 `import.meta.env.BASE_URL`（CustomCursor.tsx）

```typescript
// 修改前
img.src = `/cursors-frames/${name}/frame_${String(i).padStart(3, '0')}.png`;

// 修改后（开发模式 BASE_URL='/'，打包后 BASE_URL='./'）
img.src = `${import.meta.env.BASE_URL}cursors-frames/${name}/frame_${String(i).padStart(3, '0')}.png`;
```

由于 `vite.config.ts` 中 `base: './'`，`import.meta.env.BASE_URL` 在构建时会被替换为 `./`，这样在 `file://` 协议下路径会解析为相对于 HTML 文件的路径，可以正确找到图片。

### 修复 2：增加图片加载失败的降级处理（CustomCursor.tsx）

当所有光标帧图片加载失败时，自动回退到系统光标，避免光标完全消失：

```typescript
// 在 loadCursorImages 函数中，如果所有帧都加载失败
// 移除 data-custom-cursor 属性，恢复系统光标
if (loadedCount === 0) {
  document.documentElement.setAttribute('data-custom-cursor', 'false');
}
```

### 修复 3：main.tsx 启动时默认不隐藏系统光标

当前 `main.tsx` 第 10 行默认设置 `data-custom-cursor='true'`，这意味着在自定义光标组件加载之前系统光标就被隐藏了。应该默认设为 `'false'`，等 `CustomCursor` 组件成功加载图片后再切换：

```typescript
// 修改前
document.documentElement.setAttribute('data-custom-cursor', 'true');

// 修改后
document.documentElement.setAttribute('data-custom-cursor', 'false');
```

## 需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `CustomCursor.tsx` | 图片路径改用 `import.meta.env.BASE_URL`；增加加载失败降级处理 |
| `main.tsx` | 默认 `data-custom-cursor` 设为 `'false'` |

## 验证方式

1. 开发模式下光标正常显示
2. 打包后运行 `release\win-unpacked\脑洞集.exe`，光标正常显示
3. 如果光标帧图片意外加载失败，系统光标自动恢复（不会出现光标消失的情况）

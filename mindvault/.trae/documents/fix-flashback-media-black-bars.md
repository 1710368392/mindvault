# 修复灵感闪回区域视频/图片黑边问题

## 问题根因

两种展示模式的核心差异：

| | 画布页（无黑边） | 灵感闪回（有黑边） |
|---|---|---|
| 容器宽度 | `fit-content` 收缩到内容宽度 | `width: 100%` 撑满卡片 |
| 适应方向 | **外层容器适应内层媒体** | 内层媒体适应外层容器 |
| 结果 | 容器 = 媒体宽度，无多余空间 | 容器 > 媒体宽度，多出空间变黑边 |

## 修复方案

让灵感闪回也采用"外层容器适应内层媒体"的模式，与画布页一致。

### 1. 修改图片展示（Home.tsx ~第988行）

**容器**：
- `width: '100%'` → `width: fit-content` + `maxWidth: '100%'`
- 去掉 `aspect-ratio`、`maxHeight`（由内容自然撑开）
- 添加 `margin: '0 auto'` 居中

**图片**：
- `width: '100%'`, `height: '100%'`, `objectFit: 'contain'` → `width: '100%'`, `maxHeight: 450`
- 去掉 `height: '100%'` 和 `objectFit`，让图片按自然比例缩放

### 2. 修改视频展示（Home.tsx ~第1021行）

**容器**：
- `width: '100%'` → `width: fit-content` + `maxWidth: '100%'`
- 去掉 `aspect-ratio`、`maxHeight`
- 添加 `margin: '0 auto'` 居中

**FlashbackVideoPlayer style**：
- `width: '100%'`, `height: '100%'` → `maxWidth: '100%'`, `maxHeight: 450`

### 3. 修改 FlashbackVideoPlayer 组件

**video 元素**：
- `width: '100%'`, `height: '100%'`, `objectFit: 'contain'` → `maxWidth: '100%'`, `maxHeight: '100%'`
- 去掉 `objectFit`，视频按自然尺寸显示，不超过容器

**容器 div**：
- 添加 `width: fit-content` 让容器收缩到视频宽度

## 修改文件
1. `mindvault/src/renderer/pages/Home.tsx` — 图片和视频容器样式
2. `mindvault/src/renderer/components/common/FlashbackVideoPlayer.tsx` — video 元素和容器样式

# 修复视频封面显示不全

## 问题分析

视频帧通常是 16:9 宽屏比例，但缩略图容器是固定尺寸的正方形或矮宽矩形。使用 `objectFit: 'cover'` 会裁剪视频帧来填满容器，导致视频画面上下被裁剪，"显示不全"。

## 涉及文件

1. `Home.tsx` - `HomeThumbnail` 组件（首页最近创意列表，size=32）
2. `Search.tsx` - `MediaThumbnail` 组件（仓库页列表视图 size=40，卡片视图 size=120 + width:100%）

## 修复方案

将视频缩略图的 `objectFit` 从 `cover`（裁剪填满）改为 `contain`（完整显示，留白），确保视频帧完整显示不被裁剪。

### 具体修改

1. **Home.tsx** - `HomeThumbnail` 组件中视频缩略图的 `<img>` 样式：

   * `objectFit: 'cover'` → `objectFit: 'contain'`

   * 添加 `backgroundColor: 'var(--bg-tertiary)'` 作为留白区域背景色

2. **Search.tsx** - `MediaThumbnail` 组件中视频缩略图的 `<img>` 样式：

   * `objectFit: 'cover'` → `objectFit: 'contain'`

   * 添加 `backgroundColor: 'var(--bg-tertiary)'` 作为留白区域背景色


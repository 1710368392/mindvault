# 去掉视频容器的上一级 div

## 当前结构

```
.flashback-card (width: 100%, 块级元素)
  └─ div (第1032行, marginBottom:8, borderRadius:8, display:flex, justifyContent:center) ← 要去掉的
      └─ FlashbackVideoPlayer (width: fit-content, 被 ...style 覆盖)
          └─ video (width: 100%)
```

## 问题

第1032行的外层 div 是多余的包装层。它设了 `display: flex, justifyContent: center`，但 FlashbackVideoPlayer 内部也有 `width: fit-content`。当竖屏视频时，`playerStyle` 传入 `width: scaledWidth`，在 FlashbackVideoPlayer 内部通过 `...style` 覆盖了 `fit-content`。但这个外层 div 可能干扰了居中效果。

## 修改方案

去掉第1032行的外层 div，将 `marginBottom: 8` 和 `borderRadius: 8` 移到 FlashbackVideoPlayer 的 `playerStyle` 中。FlashbackVideoPlayer 内部容器已经有 `borderRadius: 8`，所以只需要保留 `marginBottom`。

同时，FlashbackVideoPlayer 容器需要自己处理居中：将 `width: fit-content` 改为 `width: fit-content, margin: 0 auto`，这样在 `.flashback-card` 内自动居中。

### 具体修改

1. **Home.tsx**：去掉视频外层 div（第1032行和第1059行的 `<div>...</div>`），将 `marginBottom: 8` 加入 `playerStyle`
2. **FlashbackVideoPlayer.tsx**：容器添加 `margin: '0 auto'` 实现居中

### 修改后的结构

```
.flashback-card (width: 100%, 块级元素)
  └─ FlashbackVideoPlayer (width: fit-content/scaledWidth, margin: 0 auto)
      └─ video (width: 100%)
```

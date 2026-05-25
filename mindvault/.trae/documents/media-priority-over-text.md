# 让多媒体附件优先撑满，文字适应多媒体

## 核心思路

当前：卡片宽度固定 → 文字撑满 → 视频适应剩余空间（留白多）
目标：视频按自然尺寸显示 → 卡片宽度跟随视频 → 文字适应视频宽度

也就是说：**卡片宽度由视频决定，而不是视频去适应卡片**。

## 具体方案

### 1. .flashback-card 容器改为 `width: fit-content`

当内容是视频/图片时，让卡片宽度收缩到媒体宽度，而不是撑满 Carousel 列宽。

```tsx
<div
  style={{
    padding: '16px 8px',
    borderRadius: '8px',
    ...
    width: (fb.type === 'video' || fb.type === 'image') ? 'fit-content' : undefined,
    maxWidth: '100%',
    margin: '0 auto',  // 在 Carousel slide 中居中
  }}
  className="flashback-card"
>
```

### 2. 视频/图片：按自然尺寸显示

- FlashbackVideoPlayer：`width: fit-content`（已有），video 用 `maxWidth: '100%'` + `maxHeight: 450`
- 图片：`maxWidth: '100%'` + `maxHeight: 450`（已有）
- 去掉 scaledWidth 计算逻辑（不再需要，maxHeight 会自动等比缩放）

### 3. 文字内容：适应卡片宽度

标题和文字已经是块级元素，会自动撑满父容器宽度。当卡片宽度由视频决定时，文字会自动换行适应视频宽度。

### 4. 修改后的效果

- **横屏视频（16:9, 宽540）**：卡片宽度 = 540px（不超过 Carousel 列宽），文字宽度 540px
- **竖屏视频（9:16, 宽300）**：卡片宽度 = 300px（maxHeight 限制后等比缩放的宽度），文字宽度 300px
- **纯文字卡片**：卡片宽度 = Carousel 列宽（不变）

## 修改文件

1. **Home.tsx**：
   - .flashback-card（第946行）：视频/图片类型时加 `width: fit-content, maxWidth: 100%, margin: 0 auto`
   - 去掉视频的 scaledWidth 计算逻辑
   - FlashbackVideoPlayer style：简化为 `maxWidth: 100%, maxHeight: 450`
   - 图片容器：简化，去掉外层 flex 居中 div

2. **FlashbackVideoPlayer.tsx**：
   - 容器保持 `width: fit-content, margin: 0 auto`
   - video 元素：`maxWidth: 100%, maxHeight: 450`（按自然尺寸，不超出限制）

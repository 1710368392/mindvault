# 修复竖屏视频底部截断问题

## 问题分析

当前高度限制链路：
1. `FlashbackVideoPlayer` style 中设了 `maxHeight: 450`（Home.tsx 第1027行）
2. FlashbackVideoPlayer 内部 video 元素设了 `maxHeight: '100%'`（继承父容器的 450px）
3. 容器设了 `width: 'fit-content'`

**竖屏视频被截断的原因**：
- 竖屏视频（如 9:16）自然高度远超 450px
- `maxHeight: 450` 限制了视频显示高度为 450px
- 但 `width: 'fit-content'` 让容器宽度收缩到视频自然宽度（未缩放）
- 视频被 `maxHeight` 压缩高度后，`maxWidth: '100%'` 没有同步缩放宽度
- 结果：视频高度被截断到 450px，但宽度没有等比缩小，导致底部被裁剪

## 修复方案

用户提出的思路：检测视频自然高度是否超过 maxHeight 限制，如果超过则按比例缩放视频，使高度刚好等于限制高度，宽度等比缩小，然后让外层容器适应缩小后的视频。

### 具体实现

在 `onLoadedMetadata` 回调中，当检测到视频自然高度超过 450px 时，计算等比缩放后的宽度，通过 `style.width` 显式设置视频宽度，让容器 `fit-content` 适应缩小后的尺寸。

#### 修改 Home.tsx 视频部分（~第1015行）

1. 定义常量 `FLASHBACK_MEDIA_MAX_HEIGHT = 450`（复用已有的 `FLASHBACK_MEDIA_MAX_HEIGHT` 常量，当前值为 320，需改为 450 或新增一个常量）
2. 在 `onLoadedMetadata` 回调中：
   - 获取视频自然尺寸 `video.videoWidth`, `video.videoHeight`
   - 如果 `videoHeight > FLASHBACK_MEDIA_MAX_HEIGHT`，计算缩放比 `scale = FLASHBACK_MEDIA_MAX_HEIGHT / videoHeight`
   - 计算缩放后宽度 `scaledWidth = videoWidth * scale`
   - 通过 ref 或 state 设置 FlashbackVideoPlayer 的宽度为 `scaledWidth + 'px'`
3. 使用 `flashbackMediaSizes` state 已有的尺寸数据，在渲染时计算并设置 FlashbackVideoPlayer 的 `style.width`

#### 修改 FlashbackVideoPlayer.tsx

- video 元素：去掉 `maxHeight: '100%'`，改为由外部通过 style 控制尺寸
- 当外部传入了明确的 width 时，video 元素使用 `width: '100%'` 撑满 FlashbackVideoPlayer 容器

#### 具体代码逻辑

**Home.tsx 视频渲染部分**：
```tsx
if (fb.type === 'video') {
  const mediaSize = flashbackMediaSizes[fb.id];
  let videoStyle: React.CSSProperties = {
    maxWidth: '100%',
    maxHeight: 450,
    borderRadius: 8,
  };
  // 如果已获取到视频尺寸且高度超过限制，计算等比缩放后的宽度
  if (mediaSize && mediaSize.height > 450) {
    const scale = 450 / mediaSize.height;
    const scaledWidth = Math.round(mediaSize.width * scale);
    videoStyle = {
      width: scaledWidth,
      maxWidth: '100%',
      borderRadius: 8,
    };
  }
  return (
    <div style={{ marginBottom: 8, borderRadius: 8, width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
      <FlashbackVideoPlayer style={videoStyle} ... />
    </div>
  );
}
```

**FlashbackVideoPlayer.tsx video 元素**：
- 当外部 style 包含明确的 width 时，video 用 `width: '100%'` 撑满
- 否则用 `maxWidth: '100%'` 自适应
- 统一使用 `width: '100%'`，因为 FlashbackVideoPlayer 容器已经有 `width: fit-content`，会收缩到内容宽度

## 修改文件
1. `mindvault/src/renderer/pages/Home.tsx` — 视频渲染逻辑，添加等比缩放计算
2. `mindvault/src/renderer/components/common/FlashbackVideoPlayer.tsx` — video 元素样式调整

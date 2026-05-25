# 灵感闪回多媒体自适应尺寸展示计划

## 问题分析

当前灵感闪回组件中的多媒体展示使用固定尺寸：
- **图片**：`maxHeight: 200`，`objectFit: 'cover'` — 宽图被裁剪，窄图被拉伸填满
- **视频**：`maxHeight: 240`，`width: '100%'` — 同样被固定高度截断
- **音频**：固定高度 32px 的播放条 — 音频本身没问题

问题：固定 `maxHeight` + `objectFit: cover` 导致不同宽高比的媒体被裁剪，无法完整展示原始内容。

## 修改方案：等比缩放策略

核心思路：利用图片/视频的 `onLoad` / `onLoadedMetadata` 事件获取原始尺寸，当超过阈值时按比例缩放，不超过则按原始尺寸展示。

### 修改文件：`src/renderer/pages/Home.tsx`

#### 1. 新增状态：记录媒体原始尺寸

在 flashback 相关状态附近新增：

```tsx
const [flashbackMediaSize, setFlashbackMediaSize] = useState<{ width: number; height: number } | null>(null);
```

在 `loadFlashback` 函数中切换创意时重置：

```tsx
setFlashbackMediaSize(null);
```

#### 2. 定义最大展示区域常量

```tsx
const FLASHBACK_MEDIA_MAX_WIDTH = 400;
const FLASHBACK_MEDIA_MAX_HEIGHT = 320;
```

#### 3. 新增等比缩放计算函数

```tsx
function calcScaledSize(
  origW: number, origH: number,
  maxW: number, maxH: number
): { width: number; height: number } {
  if (origW <= maxW && origH <= maxH) {
    return { width: origW, height: origH };
  }
  const scaleW = maxW / origW;
  const scaleH = maxH / origH;
  const scale = Math.min(scaleW, scaleH);
  return {
    width: Math.round(origW * scale),
    height: Math.round(origH * scale),
  };
}
```

#### 4. 图片展示改为等比缩放

**当前代码（第799-804行）：**
```tsx
<div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', maxHeight: 200 }}>
  <img src={mediaUrl} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
    onError={() => setFlashbackImgError(true)}
  />
</div>
```

**改为：**
```tsx
<div style={{
  marginBottom: 8, borderRadius: 8, overflow: 'hidden',
  display: 'flex', justifyContent: 'center',
}}>
  <img
    src={mediaUrl}
    alt=""
    draggable={false}
    onError={() => setFlashbackImgError(true)}
    onLoad={(e) => {
      const img = e.currentTarget;
      if (img.naturalWidth && img.naturalHeight) {
        setFlashbackMediaSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    }}
    style={{
      maxWidth: '100%',
      maxHeight: FLASHBACK_MEDIA_MAX_HEIGHT,
      width: flashbackMediaSize
        ? calcScaledSize(flashbackMediaSize.width, flashbackMediaSize.height, FLASHBACK_MEDIA_MAX_WIDTH, FLASHBACK_MEDIA_MAX_HEIGHT).width
        : '100%',
      height: flashbackMediaSize
        ? calcScaledSize(flashbackMediaSize.width, flashbackMediaSize.height, FLASHBACK_MEDIA_MAX_WIDTH, FLASHBACK_MEDIA_MAX_HEIGHT).height
        : 'auto',
      objectFit: 'contain',
      display: 'block',
      borderRadius: 8,
      background: 'var(--bg-tertiary)',
    }}
  />
</div>
```

**等比缩放逻辑说明：**
1. 图片首次渲染时 `flashbackMediaSize` 为 null，使用 `width: '100%'` + `height: 'auto'` 占满宽度自适应
2. `onLoad` 触发后获取原始尺寸 `naturalWidth/naturalHeight`，设置到状态
3. 重新渲染时根据 `calcScaledSize` 计算等比缩放后的精确宽高
4. 如果原始尺寸在阈值内，直接使用原始尺寸（1:1 展示）
5. 如果超过阈值，按比例缩小到阈值范围内

#### 5. 视频展示改为等比缩放

**当前代码（第810-834行）：**
```tsx
<video ... style={{ width: '100%', maxHeight: 240, borderRadius: 8, display: 'block' }} />
```

**改为：**
```tsx
<video
  ref={flashbackVideoRef}
  src={mediaUrl}
  loop
  autoPlay={saved?.playing !== false}
  muted={flashbackVolumeRef.current.muted}
  controls
  style={{
    maxWidth: '100%',
    maxHeight: FLASHBACK_MEDIA_MAX_HEIGHT,
    width: flashbackMediaSize
      ? calcScaledSize(flashbackMediaSize.width, flashbackMediaSize.height, FLASHBACK_MEDIA_MAX_WIDTH, FLASHBACK_MEDIA_MAX_HEIGHT).width
      : '100%',
    height: flashbackMediaSize
      ? calcScaledSize(flashbackMediaSize.width, flashbackMediaSize.height, FLASHBACK_MEDIA_MAX_WIDTH, FLASHBACK_MEDIA_MAX_HEIGHT).height
      : 'auto',
    borderRadius: 8,
    display: 'block',
    background: '#000',
  }}
  onLoadedMetadata={() => {
    if (flashbackVideoRef.current) {
      const video = flashbackVideoRef.current;
      if (video.videoWidth && video.videoHeight) {
        setFlashbackMediaSize({ width: video.videoWidth, height: video.videoHeight });
      }
      video.volume = flashbackVolumeRef.current.volume;
      if (saved) {
        video.currentTime = saved.currentTime;
      }
    }
  }}
  onVolumeChange={() => {
    if (flashbackVideoRef.current) {
      flashbackVolumeRef.current = { volume: flashbackVideoRef.current.volume, muted: flashbackVideoRef.current.muted };
      try { localStorage.setItem('mindvault:flashback:volume', JSON.stringify(flashbackVolumeRef.current)); } catch {}
    }
  }}
/>
```

**等比缩放逻辑说明：**
1. 与图片类似，首次渲染占满宽度
2. `onLoadedMetadata` 获取 `videoWidth/videoHeight`，设置到状态
3. 重新渲染时等比缩放

#### 6. 音频展示（无需修改）

音频播放条已经是自适应宽度，无需调整。

## 尺寸阈值说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `FLASHBACK_MEDIA_MAX_WIDTH` | 400 | 灵感闪回卡片内容区宽度约 300-400px，设为 400 确保不超出 |
| `FLASHBACK_MEDIA_MAX_HEIGHT` | 320 | 最大高度 320px，约占卡片可视区域的 60%，留出标题和文本空间 |

## 渲染流程

```
首次渲染 → width:100%, height:auto (占满宽度自适应)
    ↓
onLoad/onLoadedMetadata → 获取原始尺寸 → setFlashbackMediaSize
    ↓
重新渲染 → calcScaledSize 计算精确宽高 → 等比缩放展示
```

## 风险评估

- **低风险**：仅修改样式和新增尺寸计算逻辑，不改变组件核心交互
- `maxWidth: '100%'` + `maxHeight: 320` 仍保留上限兜底
- 小图片不会被放大，保持原始清晰度

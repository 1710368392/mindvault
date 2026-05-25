# 让上层容器适应卡片盒子宽度

## 当前问题

卡片盒子（.flashback-card）已经用了 `width: fit-content` 收缩到视频宽度，但它的上层容器（Carousel slide div）仍然是 `width: 100%`，导致卡片在更宽的轮播区域里居中，两侧有留白。

## 层级关系

```
Carousel 轮播区域（宽度 400px）
  └─ <div key={fb.id}>（第945行，Carousel slide 包装层，width:100%=400px）
      └─ .flashback-card（width: fit-content，竖屏视频时 269px，margin:0 auto 居中）
          ├─ 标题
          └─ 视频
```

## 修复方案

让第945行的 Carousel slide 包装层也用 `width: fit-content`，跟着卡片盒子走。这样整个 slide 都收缩到卡片宽度，Carousel 层面就不会有多余空间。

### 具体修改

**Home.tsx 第945行**：给 Carousel slide 的 div 也加上 `width: fit-content` + `maxWidth: '100%'` + `margin: '0 auto'`

```tsx
<div key={fb.id} style={{ width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}>
```

这样：
- Carousel slide 宽度 = 卡片宽度 = 视频宽度 + padding
- 整个 slide 在 Carousel 区域里居中
- 不再有"卡片在 slide 里居中，slide 又在 Carousel 里居中"的多层居中问题

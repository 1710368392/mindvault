# 竖屏视频两侧留白修复方案

## 问题分析

当前结构：
```
home-grid 第1列（约400px）
  └─ motion.div（无宽度限制，默认撑满）
      └─ Card（height: 100%, display: flex, flexDirection: column，默认 width: 100%，撑满 motion.div）
          └─ Carousel（flex: 1，撑满 Card body）
              └─ .slick-slide > div（flex 居中）
                  └─ .flashback-card（fit-content，收缩到视频宽度，已居中）
```

从截图看，`.flashback-card` 确实收缩了（视频宽度约253px），且在 Card 内部居中。但 **Card 组件本身还是占满了整个第1列**（约400px），所以 Card 两侧和网格列之间仍有大量留白。

## 根因

Card 组件设置了 `style: { height: '100%', display: 'flex', flexDirection: 'column' }`，宽度默认 `width: 100%`，撑满父容器（motion.div），而 motion.div 又撑满 grid 第1列。

## 解决方案

给 Card 组件添加 `width: fit-content, maxWidth: 100%', margin: '0 auto'`，让整个卡片跟着内容收缩，而不是撑满第1列。

## 修改步骤

1. **Home.tsx 第909行**：Card 组件 style 从：
   ```tsx
   style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
   ```
   改为：
   ```tsx
   style={{ height: '100%', display: 'flex', flexDirection: 'column', width: 'fit-content', maxWidth: '100%', margin: '0 auto' }}
   ```

2. 如果 Card 收缩后导致 motion.div 也收缩，需要检查 motion.div 是否需要额外样式（如 `display: flex`, `justifyContent: 'center'`）来确保 Card 在 grid 列中居中。但根据现有结构，Card 的 `margin: '0 auto'` 应该能处理居中。

## 验证

修改后，竖屏视频的 Card 应该收缩到接近视频宽度（约253px + padding），两侧不再撑满整个 grid 列，留白问题得到解决。

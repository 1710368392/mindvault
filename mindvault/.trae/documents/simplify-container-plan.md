# 彻底简化容器层级方案

## 问题回顾

当前有多层容器嵌套导致留白：
```
Card body → Carousel（100%）→ Ant Design slick 容器 → div key={fb.id} → .flashback-card → 视频
```

## 改造方案

### 目标结构（尽量扁平化）
```
Card body
  ├─ Carousel（不设置 width）
  │   └─ Ant Design 内部 slick-slide
  │       └─ .flashback-card（视频/image优先，去掉中间 div key={fb.id}）
  │           ├─ 标签行
  │           ├─ 标题
  │           └─ 视频/image（决定宽度）
  └─ Carousel 让最外层的 Card body（或 Card）去适应？
```

### 具体步骤

1. **去掉中间的 div key={fb.id} 包装层**，把 Carousel 子元素直接设为 .flashback-card
2. **.flashback-card** 继续保持 `width: fit-content, maxWidth: 100%, margin: 0 auto`
3. **Carousel** 去掉 `width: fit-content`，让它自然撑满 Card body
4. **关键 CSS**：给 Ant Design Carousel 的内部 slick-slide 容器也设置 `text-align: center` 或 `display: flex, justify-content: center`
5. 如果还不行，可能需要给 Card 本身也设置 `width: fit-content, maxWidth: 100%, margin: 0 auto`（在三列网格里收缩）

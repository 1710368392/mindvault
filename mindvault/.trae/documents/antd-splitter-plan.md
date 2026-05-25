# 使用 antd Splitter 实现左中右三栏可调节分割

## 现状分析

当前 Header 采用三栏 flex 布局：

```
┌──────────┬──────────────────────────────────┬──────────────────┐
│ 左侧区域  │     中间区域（走马灯/音乐播放器）    │    右侧区域       │
│ 返回+标题  │     Carousel (flex: 1)           │ 视图切换+用户菜单  │
└──────────┴──────────────────────────────────┴──────────────────┘
```

- **左侧区域**（[Header.tsx:704-775](file:///d:/Android/Code/naodong/mindvault/src/renderer/components/layout/Header.tsx#L704-L775)）：返回按钮 + 标题，`flexShrink: 0`
- **中间区域**（[Header.tsx:777-997](file:///d:/Android/Code/naodong/mindvault/src/renderer/components/layout/Header.tsx#L777-L997)）：走马灯容器，`flex: 1`，`maxWidth: 800`
- **右侧区域**（[Header.tsx:999-1317](file:///d:/Android/Code/naodong/mindvault/src/renderer/components/layout/Header.tsx#L999-L1317)）：视图模式切换器 + 用户菜单 + 搜索按钮，`flexShrink: 1`

目前三栏是固定比例的 flex 布局，无法手动调节宽度。

## 方案：使用 antd Splitter 实现三栏可调节

antd v6.3.6 完全支持 `Splitter` 组件（自 5.21.0 引入），可以直接使用。

### 目标布局

```
┌──────────┬──────────────────────────────────┬──────────────────┐
│ Splitter  │  Splitter.Panel (走马灯)   │⟋│ Splitter.Panel    │
│ .Panel    │     可拖拽调节宽度          │⟋│ 视图切换+用户菜单   │
│ 返回+标题  │                            │⟋│                   │
└──────────┴──────────────────────────────────┴──────────────────┘
     ↑ 拖拽分割线                    ↑ 拖拽分割线
```

三栏各自作为 `<Splitter.Panel>`，中间有两条可拖拽的分割线。

### 实施步骤

1. **添加 Splitter 导入**
   - 在 [Header.tsx:4](file:///d:/Android/Code/naodong/mindvault/src/renderer/components/layout/Header.tsx#L4) 修改：`import { Carousel, Splitter } from 'antd';`

2. **重构整个 Header 内容区域为 Splitter 结构**
   - 将当前三个并列的 flex 子元素替换为 `<Splitter>` 包裹的三个 `<Splitter.Panel>`
   - 左侧 Panel：返回按钮 + 标题
   - 中间 Panel：走马灯/音乐播放器
   - 右侧 Panel：视图切换器 + 用户菜单 + 搜索按钮

3. **各 Panel 配置**
   - **左侧 Panel**：`defaultSize="15%"`，`min={80}`，`max={300}`，`collapsible={true}`
   - **中间 Panel**：`defaultSize="55%"`，`min={300}`（走马灯需要足够空间显示播放器控件）
   - **右侧 Panel**：`defaultSize="30%"`，`min={200}`（确保视图切换器和菜单不被压扁），`collapsible={true}`

4. **样式调整**
   - `<Splitter>` 设置 `style={{ flex: 1, height: '100%' }}`
   - 移除走马灯容器的 `maxWidth: 800` 限制（由 Splitter 控制宽度）
   - 移除左侧区域的 `flexShrink: 0`（由 Splitter 控制宽度）
   - 移除右侧区域的 `flexShrink: 1`（由 Splitter 控制宽度）
   - 各 Panel 内部保持原有的 `display: flex; align-items: center` 布局

5. **Splitter 分割线样式定制**
   - 通过 CSS 定制分割线样式，使其与现有拟物风格 UI 协调
   - 分割线颜色建议使用半透明色或 `var(--border-light)`

### 关键代码变更

**修改前（简化）：**
```tsx
<header style={{ display: 'flex', ... }}>
  <div style={{ flexShrink: 0 }}>左侧：返回+标题</div>
  <div style={{ flex: 1 }}>中间：走马灯</div>
  <div style={{ flexShrink: 1 }}>右侧：视图切换+菜单</div>
</header>
```

**修改后（简化）：**
```tsx
<header style={{ display: 'flex', ... }}>
  <Splitter style={{ flex: 1, height: '100%' }}>
    <Splitter.Panel defaultSize="15%" min={80} max={300} collapsible>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        左侧：返回+标题
      </div>
    </Splitter.Panel>
    <Splitter.Panel defaultSize="55%" min={300}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        中间：走马灯
      </div>
    </Splitter.Panel>
    <Splitter.Panel defaultSize="30%" min={200} collapsible>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        右侧：视图切换+菜单
      </div>
    </Splitter.Panel>
  </Splitter>
</header>
```

### 注意事项

- Splitter 默认是水平分割（左右布局），符合需求
- Splitter 的拖拽手柄会自动渲染，无需额外代码
- 需要确保 Splitter 的高度与 Header 一致
- 走马灯内部的 `maxWidth: 800` 需要移除或改为 `100%`，让 Splitter 控制面板宽度
- 左侧区域在非 Board 页面时内容较少（只有标题），设置 `collapsible` 允许折叠
- 右侧区域也可以设置 `collapsible`，在不需要时折叠
- Splitter 的 `onResize` 回调可用于持久化用户调整的面板比例（可选，后续扩展）

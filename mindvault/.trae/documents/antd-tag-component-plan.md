# Ant Design Tag 组件分析与项目应用计划

## 一、antd Tag 组件是什么？（大白话解释）

**打个比方**：你逛超市时，商品上贴的那些小标签——"新品"、"打折"、"有机"——就是 Tag。它小小的、圆角的、带颜色的，一眼就能看出东西属于哪个分类。

**在 UI 里**：Tag 就是一个**小药丸形状的标签**，用来给内容打标记、做分类。比如：

* 一个创意卡片下面挂着 `#灵感` `#工作` `#重要` 这些小标签

* 筛选器里点选标签来过滤内容

* 标签可以关闭（点 × 删掉）、可以选中（变成高亮）

**antd Tag 的核心能力**：

| 功能    | 说明               | 对应属性                 |
| ----- | ---------------- | -------------------- |
| 基础标签  | 显示文字的小药丸         | `<Tag>标签名</Tag>`     |
| 可关闭   | 标签右侧出现 × 按钮      | `closable`           |
| 可选中   | 点击标签切换选中/未选中     | `<Tag.CheckableTag>` |
| 预设颜色  | 红/绿/蓝/橙等 10+ 种颜色 | `color="red"`        |
| 自定义颜色 | 任意色值             | `color="#6C63FF"`    |
| 图标标签  | 标签前带图标           | `icon={<Star />}`    |

***

## 二、项目当前标签渲染的问题

经过搜索，项目中 **7 个文件** 有标签渲染，但样式**极不统一**：

| 文件               | 前缀     | 圆角   | 字号   | 内边距         | 背景          | 溢出提示 |
| ---------------- | ------ | ---- | ---- | ----------- | ----------- | ---- |
| Search.tsx 列表    | `#`    | var  | 11px | 2px 8px     | bg-tertiary | 无    |
| Search.tsx 瀑布流   | `#`    | 99   | 10px | 2px 8px     | bg-tertiary | +N   |
| CardItem.tsx     | 无      | full | 10px | px-2 py-0.5 | primary-bg  | +N   |
| MasonryCard.tsx  | `#`    | 999  | 11px | 4px 10px    | bg-tertiary | +N   |
| StickyCard.tsx   | 无      | full | 11px | 2px 8px     | rgba黑       | +N   |
| Favorites.tsx    | Tag图标  | 99   | 11px | 3px 10px    | bg-tertiary | +N   |
| OutlineView\.tsx | Hash图标 | 999  | 12px | 3px 10px    | bg-tertiary | 无    |

**问题总结**：

1. **样式碎片化**：同样的标签在 7 个地方有 7 种写法，改一个样式要改 7 处
2. **前缀不统一**：有的用 `#`，有的用 Tag 图标，有的用 Hash 图标，有的啥也没有
3. **没有利用 tag.color**：除了 CardItem.tsx 用了 `tag.color` 渲染颜色圆点，其他地方全是灰色
4. **标签不可交互**：除了 OutlineView 支持双击编辑，其他地方的标签都是纯展示，不可点击筛选

***

## 三、antd Tag 可以用在项目的哪些地方

### 场景 1：统一标签展示（推荐 ✅）

**替换位置**：上述 7 个文件中的所有 `<span>` 标签渲染

**替换前**（每个文件写法不同）：

```tsx
<span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
  #{tag.name}
</span>
```

**替换后**（统一使用 antd Tag）：

```tsx
<Tag color={tag.color || undefined} style={{ borderRadius: 99 }}>
  {tag.name}
</Tag>
```

**好处**：

* 一处定义，处处统一

* 自动适配深色/浅色主题

* `tag.color` 天然支持，不同标签可以有不同颜色

* 代码量减少，不用每次手写一坨 inline style

***

### 场景 2：标签筛选器（新增功能 ✅）

**位置**：Search.tsx 搜索页面的筛选区域

**效果**：点击标签即可筛选包含该标签的创意

```tsx
<Tag.CheckableTag
  checked={selectedTags.includes(tag.name)}
  onChange={() => toggleTag(tag.name)}
>
  {tag.name}
</Tag.CheckableTag>
```

**打比方**：就像淘宝筛选商品时，点"红色"标签就只看红色商品，再点一次取消筛选。

***

### 场景 3：可删除的标签（编辑模式 ✅）

**位置**：CardEditor、CardPreview、QuickCapture 的编辑界面

**效果**：标签右侧有 × 按钮，点击可移除

```tsx
<Tag
  closable
  onClose={() => handleRemoveTag(tag)}
  color={tag.color}
>
  {tag.name}
</Tag>
```

**打比方**：就像邮件里的标签，不想要了点 × 就能摘掉。

***

### 场景 4：标签输入建议（新增功能 ✅）

**位置**：QuickCapture、CardEditor 的标签输入框下方

**效果**：输入时显示已有标签建议，点击即可添加

```tsx
{existingTags
  .filter(t => t.name.includes(tagInput))
  .map(t => (
    <Tag.CheckableTag
      key={t.id}
      checked={tags.includes(t.name)}
      onChange={() => toggleTag(t.name)}
      color={t.color}
    >
      {t.name}
    </Tag.CheckableTag>
  ))}
```

***

## 四、实施计划

### 第一步：统一标签展示组件

创建一个项目级的 `<CreativityTag>` 包装组件，封装 antd Tag + 项目统一样式：

* 文件：`src/renderer/components/common/CreativityTag.tsx`

* 统一圆角、字号、内边距、颜色逻辑

* 支持 `closable`、`checkable`、`color` 等属性

* 自动处理 `tag.color` 渲染

### 第二步：替换 7 个文件中的标签渲染

逐个文件将手写的 `<span>` 标签替换为 `<CreativityTag>`：

1. Search.tsx（2处：列表视图 + 瀑布流视图）
2. CardItem.tsx（1处）
3. MasonryCard.tsx（1处）
4. StickyCard.tsx（1处）
5. Favorites.tsx（1处）
6. OutlineView\.tsx（1处，保留双击编辑功能）
7. CardPreview\.tsx（1处，子类型标签）

### 第三步：补全编辑界面的标签 UI

为 CardEditor、CardPreview、QuickCapture 三个组件补全标签输入/展示 UI（目前状态和逻辑已有，但 UI 缺失）。

### 第四步：搜索页标签筛选

在 Search.tsx 中添加 `Tag.CheckableTag` 筛选器，支持按标签过滤创意。

***

## 五、主题适配问题（重要）

### 现状

项目**没有使用** antd 的 `ConfigProvider` + `theme` 配置。主题切换是通过 `document.documentElement.setAttribute('data-theme', xxx)` 切换 CSS 变量实现的，有 6 套主题（light/dark/morandi-warm/morandi-cool/morandi-nature/custom）。

antd 组件的主题适配是通过 **CSS `!important` 覆盖 + CSS 变量引用** 实现的，已有 13 个 antd 组件有专门的覆盖样式文件（如 ant-modal.css、ant-button.css 等）。

### antd Tag 能随主题变化吗？

**不指定 color 时**：antd Tag 默认是灰色背景，**不会自动跟随主题变化**。在深色主题下可能显得突兀。

**指定 color 时**：antd Tag 的 `color` 属性会生成固定色值的背景和文字，**也不跟随主题变化**。但这其实是对的——标签本来就是五颜六色的，固定颜色反而更醒目。

### 解决方案：新增 ant-tag.css 覆盖文件

和项目中其他 antd 组件一样，创建 `ant-tag.css` 覆盖文件，让**无颜色的默认 Tag** 跟随主题：

```css
/* 默认标签跟随主题 */
.ant-tag {
  background-color: var(--bg-tertiary) !important;
  color: var(--text-secondary) !important;
  border: none !important;
  border-radius: 999px !important;
}

/* 深色主题微调 */
[data-theme='dark'] .ant-tag {
  background-color: var(--bg-tertiary) !important;
}

/* CheckableTag 未选中态 */
.ant-tag-checkable:not(.ant-tag-checkable-checked) {
  background-color: var(--bg-tertiary) !important;
  color: var(--text-secondary) !important;
}

/* CheckableTag 选中态 */
.ant-tag-checkable-checked {
  background-color: var(--primary-color) !important;
  color: white !important;
}
```

**效果**：
- 无颜色的默认 Tag → 跟随主题（背景用 `var(--bg-tertiary)`，文字用 `var(--text-secondary)`）
- 有颜色的 Tag（`color="#6C63FF"`）→ 保持固定颜色，五颜六色不受影响
- CheckableTag → 选中态用 `var(--primary-color)`，也跟随主题

**打比方**：就像标签本身是彩色贴纸（有颜色的保持原色），但没上色的空白标签纸会随灯光环境变色（跟随主题）。

---

## 六、其他注意事项

1. **tag.color 字段**：数据库中标签表已有 `color` 字段，但大部分渲染位置未使用，统一后可充分利用
2. **性能**：antd Tag 是轻量组件，不会影响渲染性能
3. **渐进式替换**：可以先做第一步和第二步（统一展示），第三步和第四步作为后续优化


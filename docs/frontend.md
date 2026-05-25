# 脑洞集 (MindVault) - 前端技术文档

&gt; **最后更新**: 2026-04-21  
&gt; **维护者**: 前端工程师专用窗口  
&gt; **项目根目录**: `d:\Android\Code\脑洞集\mindvault`

---

## 一、技术栈概览

### 核心技术

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **桌面框架** | Electron | 33.2.1 | 跨平台桌面应用 |
| **前端框架** | React | ^18.3.0 | UI 组件化开发 |
| **语言** | TypeScript | ^5.6.0 | 类型安全 |
| **构建工具** | Vite | ^6.0.0 | 快速开发与构建 |
| **路由** | React Router DOM | ^6.26.0 | 单页应用路由 |
| **状态管理** | Zustand | ^4.5.0 | 全局状态管理 |
| **样式方案** | Tailwind CSS v4 | ^4.0.0 | 原子化 CSS |
| **动画库** | Framer Motion | ^11.0.0 | 流畅动画效果 |
| **图标库** | Lucide React | ^0.400.0 | 统一风格图标 |
| **数据可视化** | ECharts | ^5.5.0 | 统计图表展示 |
| **Markdown 编辑器** | @uiw/react-md-editor | ^4.1.0 | 富文本编辑 |
| **Markdown 渲染** | react-markdown + remark-gfm | ^10.1.0 | Markdown 渲染 |
| **数据库** | Better-SQLite3 | ^11.0.0 | 本地数据存储 |

### 开发工具

- **ESLint**: 代码质量检查
- **PostCSS + Autoprefixer**: CSS 前缀自动处理
- **electron-builder**: 应用打包

---

## 二、前端代码目录结构

```
mindvault/src/renderer/
├── App.tsx                          # 根组件：路由配置、全局弹窗、拖拽处理、Toast
├── main.tsx                         # 入口文件：挂载 React、引入样式
├── index.html                       # HTML 模板
├── vite-env.d.ts                    # Vite 类型声明
│
├── pages/                           # 页面组件 (9个页面)
│   ├── Home.tsx                     # 首页：欢迎横幅、统计卡片、灵感闪回、最近创意
│   ├── Board.tsx                    # 看板页：6种视图模式切换、卡片交互
│   ├── Search.tsx                   # 搜索页：关键词搜索、筛选、排序、批量操作
│   ├── Templates.tsx                # 模板库：分类浏览、创建/编辑/删除模板
│   ├── Settings.tsx                 # 设置页：外观/音效/备份/隐私 4个Tab
│   ├── Export.tsx                   # 导出导入：JSON/Markdown/HTML 导出、JSON 导入
│   ├── Favorites.tsx                # 收藏页：收藏的创意列表
│   ├── Trash.tsx                    # 回收站：恢复/永久删除/清空
│   └── Stats.tsx                    # 统计页：重定向到 StatsDashboard
│
├── components/                      # 通用组件
│   ├── layout/                      # 布局组件
│   │   ├── Sidebar.tsx              # 侧边栏：导航、看板列表、主题切换
│   │   ├── Header.tsx               # 顶部栏：页面标题、搜索按钮、视图切换
│   │   └── MainContent.tsx          # 主内容区容器
│   │
│   ├── board/                       # 看板视图组件 (6种)
│   │   ├── BoardView.tsx            # 看板视图（便利贴）
│   │   ├── CanvasView.tsx           # 画布视图（自由拖拽）
│   │   ├── GraphView.tsx            # 图谱视图（节点关系图）
│   │   ├── FolderView.tsx           # 文件夹视图
│   │   ├── TimelineView.tsx         # 时间线视图
│   │   └── OutlineView.tsx          # 大纲视图
│   │
│   ├── card/                        # 卡片组件
│   │   ├── CardItem.tsx             # 基础卡片项
│   │   ├── CardPreview.tsx          # 卡片预览弹窗
│   │   ├── CardEditor.tsx           # 卡片编辑器
│   │   ├── CardContextMenu.tsx      # 卡片右键菜单
│   │   ├── CardStyles.tsx           # 卡片样式定义
│   │   └── StickyCard.tsx           # 便利贴卡片
│   │
│   ├── common/                      # 公共组件
│   │   ├── AnimatedButton.tsx       # 带动画的按钮
│   │   ├── ConfirmDialog.tsx        # 确认对话框
│   │   └── ThemeSwitcher.tsx        # 主题切换器
│   │
│   ├── dashboard/
│   │   └── StatsDashboard.tsx       # 数据统计仪表盘（ECharts图表）
│   │
│   ├── quick-capture/               # 快速录入
│   │   ├── QuickCapture.tsx         # 快速录入弹窗
│   │   └── DropZone.tsx             # 拖拽放置区
│   │
│   ├── AboutDialog.tsx              # 关于弹窗
│   ├── FloatingEditorManager.tsx    # 浮动编辑器管理器
│   ├── PrivacyLock.tsx              # 隐私锁界面
│   ├── SearchDialog.tsx             # 全局搜索弹窗 (Cmd+K)
│   └── ShortcutGuide.tsx            # 快捷键速查表
│
├── hooks/                           # 自定义 Hooks (6个)
│   ├── useTheme.ts                  # 主题管理（切换/读取/选项列表）
│   ├── useSearch.ts                 # 搜索逻辑（关键词/筛选/排序/分页）
│   ├── useKeyboardShortcuts.ts      # 全局快捷键
│   ├── useAudioRecorder.ts          # 音频录制
│   ├── useAutoSave.ts               # 自动保存
│   └── useMarkdownWordCount.ts      # Markdown 字数统计
│
├── stores/                          # Zustand 状态管理 (4个)
│   ├── uiStore.ts                   # UI 状态：侧边栏、弹窗、Toast、编辑器、待处理文件
│   ├── creativityStore.ts           # 创意数据：CRUD、统计、列表、随机获取
│   ├── boardStore.ts                # 看板数据：看板列表、当前看板、视图模式、画布项
│   └── settingsStore.ts             # 应用设置：主题、音效、备份、隐私锁
│
├── styles/                          # 样式文件
│   ├── globals.css                  # 全局样式 + CSS变量定义 + Tailwind引入
│   ├── components/
│   │   ├── animations.css           # 动画关键帧
│   │   ├── custom-cursor.css        # 自定义光标样式
│   │   └── sticky-card.css          # 便利贴样式
│   └── themes/                      # 主题文件 (5个)
│       ├── light.css                # 经典白主题（默认）
│       ├── dark.css                 # 经典黑主题
│       ├── morandi-warm.css         # 莫兰迪暖调主题
│       ├── morandi-cool.css         # 莫兰迪冷调主题
│       └── morandi-nature.css       # 莫兰迪自然主题
│
├── types/                           # TypeScript 类型定义
│   ├── creativity.ts                # 创意相关类型
│   ├── board.ts                     # 看板相关类型
│   └── settings.ts                  # 设置相关类型
│
├── utils/                           # 工具函数
│   ├── api.ts                       # Electron IPC API 封装
│   ├── exporters.ts                 # 导出功能（JSON/Markdown/HTML）
│   ├── formatters.ts                # 格式化工具（时间、文本截断）
│   ├── sound.ts                     # 音效播放
│   └── validators.ts                # 数据校验
│
└── public/                          # 静态资源
    └── cursors/                     # 自定义光标文件 (.ani)

src/shared/                          # 主进程与渲染进程共享
├── constants.ts                     # 常量：APP_NAME、主题选项、创意类型、优先级
└── types.ts                         # 共享类型定义（Creativity, Board, Template, AppSettings 等）
```

---

## 三、已实现的界面与功能

### 3.1 首页 (Home)
- **路由**: `/`
- **功能**:
  - 欢迎横幅：渐变背景 + "开始记录" 按钮
  - 统计卡片：总创意数、今日新增、本周新增、标签数
  - 灵感闪回：随机展示一条创意，支持刷新
  - 最近创意列表：展示最新5条，支持拖拽排序
  - 右键菜单：编辑/复制/移到回收站
  - 卡片预览弹窗

### 3.2 看板页 (Board)
- **路由**: `/board/:id`
- **功能**:
  - 6种视图模式切换：看板、画布、图谱、文件夹、时间线、大纲
  - 卡片拖拽到看板
  - 卡片预览弹窗
  - 右键菜单：编辑/复制/移到回收站
  - 看板信息展示：名称 + 描述

### 3.3 搜索页 (Search)
- **路由**: `/search`
- **功能**:
  - 关键词搜索：实时搜索 + 回车触发
  - 关键词高亮显示
  - 类型筛选：文本/图片/音频/链接/视频
  - 优先级筛选
  - 排序功能：更新时间/创建时间/标题/优先级（升序/降序）
  - 批量操作模式：批量删除、批量修改标签
  - 分页功能
  - 右键菜单

### 3.4 模板库 (Templates)
- **路由**: `/templates`
- **功能**:
  - 分类标签筛选：全部/产品/写作/旅行/学习/效率/阅读
  - 模板网格展示
  - 创建自定义模板
  - 编辑模板（右键菜单）
  - 删除模板（右键菜单，内置模板不可删除）
  - 点击模板打开快速录入

### 3.5 设置页 (Settings)
- **路由**: `/settings`
- **功能**:
  - **外观设置**: 5种主题切换、字体大小、行高、预览
  - **音效设置**: 启用/关闭、音量调节、试听按钮
  - **备份设置**: 自动备份开关、备份间隔、倒计时、手动备份/恢复、备份路径
  - **隐私设置**: 隐私锁开关、密码设置（SHA-256哈希）、密码强度检测
  - 关于信息

### 3.6 导出导入 (Export)
- **路由**: `/export`
- **功能**:
  - JSON 格式导出
  - Markdown 格式导出
  - HTML 格式导出
  - JSON 文件导入（支持数据验证）

### 3.7 收藏页 (Favorites)
- **路由**: `/favorites`
- **功能**:
  - 收藏的创意网格展示
  - 卡片预览弹窗
  - 右键菜单

### 3.8 回收站 (Trash)
- **路由**: `/trash`
- **功能**:
  - 已删除创意列表
  - 恢复创意
  - 永久删除（二次确认）
  - 清空回收站（二次确认）
  - 拖放创意到回收站

### 3.9 统计仪表盘 (Stats)
- **路由**: `/stats`
- **功能**:
  - ECharts 图表展示
  - 创意总数、今日新增等统计卡片

### 3.10 全局组件与功能
- **侧边栏 (Sidebar)**: 导航菜单、看板列表（展开/折叠）、新建看板、主题切换、快速录入按钮
- **顶部栏 (Header)**: 页面标题、搜索按钮、看板视图切换（6种视图）
- **快速录入 (QuickCapture)**: 弹窗式录入、支持模板选择、支持拖拽文件
- **浮动编辑器 (FloatingEditorManager)**: 浮动窗口编辑创意
- **全局搜索 (SearchDialog)**: Cmd+K 快捷键触发
- **隐私锁 (PrivacyLock)**: 启动时密码验证
- **关于弹窗 (AboutDialog)**: 应用信息
- **快捷键速查 (ShortcutGuide)**: 快捷键列表
- **Toast 通知**: 操作反馈
- **全局拖拽**: 文件拖入应用自动打开快速录入
- **全局快捷键**: 支持菜单事件监听

---

## 四、主题系统

应用支持 **5 种主题**，通过 CSS 变量 + `data-theme` 属性实现切换：

| 主题 | data-theme 值 | 主色调 | 风格 |
|------|--------------|--------|------|
| 经典白 | `light` | #6C63FF | 默认，明亮 |
| 经典黑 | `dark` | #8B85FF | 深色护眼 |
| 莫兰迪暖 | `morandi-warm` | #C4A882 | 温暖舒适 |
| 莫兰迪冷 | `morandi-cool` | #8FA4B2 | 冷静专业 |
| 莫兰迪自然 | `morandi-nature` | #8FA882 | 自然清新 |

---

## 五、需要修改或优化的界面

### 5.1 高优先级

1. **样式内联问题**：几乎所有组件都使用 `style={{}}` 内联样式，代码冗余严重，维护困难
   - **建议**: 抽取为 CSS Modules 或 Tailwind 类名，减少内联样式

2. **TypeScript 类型安全**：多处使用 `any` 类型（如 `handleSave` 中的 `data: any`）
   - **建议**: 定义完整的类型接口

### 5.2 中优先级

3. **组件拆分**：
   - `Settings.tsx` 文件过长（约 894 行），应拆分为独立子组件文件
   - `Search.tsx` 过长（约 877 行），批量操作逻辑应抽取
   - `Templates.tsx` 过长（约 815 行），创建/编辑表单应抽取
   - `Home.tsx` 过长（约 456 行），灵感闪回和最近创意应抽取

4. **重复代码**：右键菜单逻辑在 Home、Search、Board、Favorites、Trash 中重复实现
   - **建议**: 抽取为 `useContextMenu` Hook

5. **重复代码**：类型图标映射 `typeIcons` 在多个文件中重复定义
   - **建议**: 抽取到 `utils/icons.ts` 或 `constants.ts`

6. **API 调用不统一**：部分页面直接调用 `api.creativity.xxx`，部分通过 Store
   - **建议**: 统一数据获取模式

### 5.3 低优先级

7. **骨架屏**：搜索页和首页使用了 `className="skeleton"` 但未定义对应 CSS 动画
8. **无障碍性**：缺少 ARIA 标签、键盘导航支持不足
9. **响应式适配**：当前仅适配桌面端，未做移动端响应式
10. **国际化**：所有文案硬编码为中文，未做 i18n 支持
11. **错误边界**：缺少 React Error Boundary 组件
12. **性能优化**：部分列表未使用虚拟滚动（如搜索结果、回收站）
13. **单元测试**：缺少 Jest/Vitest 测试用例

---

## 六、路由结构

```
/                          → Home（首页）
/board/:id                 → Board（看板页）
/search                    → Search（搜索页）
/templates                 → Templates（模板库）
/settings                  → Settings（设置页）
/export                    → Export（导出导入）
/trash                     → Trash（回收站）
/favorites                 → Favorites（收藏页）
/stats                     → StatsDashboard（统计仪表盘）
```

**注意**: 路由使用 `HashRouter`，适配 Electron 的 `file://` 协议。

---

## 七、状态管理架构

### 7.1 Stores 概览

| Store | 文件 | 职责 |
|-------|------|------|
| `uiStore` | `stores/uiStore.ts` | UI 状态：侧边栏、弹窗、Toast、编辑器、待处理文件 |
| `creativityStore` | `stores/creativityStore.ts` | 创意数据：CRUD、统计、列表、随机获取 |
| `boardStore` | `stores/boardStore.ts` | 看板数据：看板列表、当前看板、视图模式、画布项 |
| `settingsStore` | `stores/settingsStore.ts` | 应用设置：主题、音效、备份、隐私锁 |

### 7.2 使用方式

所有 Store 基于 Zustand，通过 `useXxxStore((s) => s.xxx)` 按需订阅，避免不必要的重渲染：

```typescript
const { sidebarOpen, setSidebarOpen } = useUIStore((s) => ({
  sidebarOpen: s.sidebarOpen,
  setSidebarOpen: s.setSidebarOpen,
}));
```

---

## 八、IPC 通信

前端通过 `window.electronAPI` 与 Electron 主进程通信：

| 模块 | 主要方法 |
|------|---------|
| `creativity` | create, update, delete, list, toggleFavorite, permanentDelete, batchUpdate |
| `board` | list, get, create, update, delete, addCreativityRelation |
| `search` | search |
| `settings` | get, set |
| `backup` | create, restore |
| `media` | 处理媒体文件 |
| `template` | list, create, update, delete |

**位置**: `src/renderer/utils/api.ts`

---

## 九、开发命令

```bash
# 仅启动 Vite Web 开发服务器（推荐先运行此命令进行 UI 开发）
npm run dev:web

# 启动完整的 Electron 应用（会自动启动 Vite + Electron）
npm run dev

# 仅构建前端渲染层
npm run build:renderer

# 完整构建（TypeScript 编译 + Vite 构建 + Electron 打包）
npm run build

# TypeScript 类型检查
npm run typecheck
```

### 开发流程建议

1. 先运行 `npm run dev:web` 启动 Web 开发服务器，在浏览器中开发和调试 UI
2. Web 开发服务器运行在 `http://localhost:5173`
3. UI 调试完成后，运行 `npm run dev` 启动完整的 Electron 应用进行集成测试

---

## 十、开发注意事项

### 10.1 路径别名

```typescript
@renderer → src/renderer
@shared   → src/shared
```

### 10.2 Vite 配置

- **root**: `src/renderer`
- **构建输出**: `dist/renderer`
- **端口**: 5173

### 10.3 环境要求

- **Node.js**: 18+ （推荐 20 LTS 或更高版本）
- **npm**: 9+

### 10.4 Electron 镜像

国内用户安装 Electron 时可能需要设置镜像源：

```powershell
# Windows PowerShell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
npm install
```

### 10.5 数据存储

应用数据存储在本地 SQLite 数据库中，请注意定期备份。

---

## 十一、后续前端开发任务

本窗口将负责以下所有前端开发任务：

- 新功能的前端界面开发
- 现有界面的优化与重构
- Bug 修复
- 性能优化
- 组件库建设
- 样式规范统一
- TypeScript 类型完善
- 测试用例编写

---

**文档结束**

---
*本窗口为前端工程师专用窗口，所有前端开发任务由本窗口处理。*

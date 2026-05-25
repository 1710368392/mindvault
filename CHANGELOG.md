# 脑洞集 (MindVault) 变更日志

> 文档工程师专用窗口维护 | 最后更新：2026-04-21

---

## [2026-04-21] 重大功能更新

### ✨ 新增功能特性

- **大纲视图 (OutlineView)** - 新增第五种看板视图模式，提供树形大纲展示
- **时间线视图 (TimelineView)** - 新增第六种看板视图模式，时间轴展示创意
- **AI 推荐服务 (ai-recommend.ts)** - 集成 AI 智能推荐功能，基于内容关联推荐相关创意
- **自动保存 Hook (useAutoSave)** - 编辑器自动保存功能，防止内容丢失
- **音频录制 Hook (useAudioRecorder)** - 内置语音速记功能，支持录制和播放
- **Markdown 字数统计 Hook (useMarkdownWordCount)** - 实时统计字数和阅读时间
- **自定义光标系统** - 新增 20+ 种自定义光标效果，提升创作体验
- **浮动编辑器管理器 (FloatingEditorManager)** - 可拖拽的浮动编辑窗口
- **大纲、时间线和其他视图的完整实现** - 现在共有 6 种视图模式！

### 🏗️ 架构升级

- **数据库仓储模式 (repository.ts)** - 重构数据访问层，采用 Repository 设计模式
- **数据库迁移系统 (migration.ts)** - 新增数据库版本管理和自动迁移机制
- **模块化 IPC 系统 (ipc/*)** - IPC 处理器完全模块化，每个模块独立管理
- **业务服务层 (services/)** - 新增专门的业务服务层，分离关注点
- **TypeScript 类型增强** - 完整的类型定义，提升代码质量
- **完整的类型声明文件 (d.ts)** - 所有模块都有对应的类型声明

### 🎨 UI 完善

- **新增 3 套莫兰迪主题** - morandi-cool (冷调)、morandi-nature (自然)、morandi-warm (暖调)
- **确认对话框 (ConfirmDialog)** - 通用确认弹窗组件
- **主题切换器 (ThemeSwitcher)** - 优雅的主题选择界面
- **动画系统 (animations.css)** - 统一的交互动画库
- **便利贴卡片样式 (sticky-card.css)** - 精美卡片样式
- **ECharts 数据可视化集成** - 支持复杂图表展示

### 🔧 技术栈更新

| 类别 | 旧版本 | 新版本 |
|------|--------|--------|
| Electron | 20+ | 33+ |
| 构建工具 | Vite 6 | Vite 6 |
| 样式方案 | CSS 变量 | Tailwind CSS 4 + CSS 变量 |
| 数据可视化 | Recharts 2 | ECharts 5 |
| 动画库 | - | Framer Motion 11 |
| 图标库 | - | Lucide React |
| 路由 | - | React Router DOM 6 |

### 📝 开发体验提升

- **Web 开发模式 (dev:web)** - 支持纯浏览器开发，无需 Electron 环境
- **TypeScript 类型检查 (typecheck)** - 专门的类型检查命令
- **模块化构建流程** - 分离的渲染层构建和完整构建

### 📁 项目结构重大调整

```
新增文件：
├── src/main/db/
│   ├── migration.ts       # 数据库迁移
│   └── repository.ts      # 数据库仓储
├── src/main/ipc/          # 模块化 IPC 处理器
│   ├── board.ts
│   ├── creativity.ts
│   ├── search.ts
│   ├── settings.ts
│   ├── backup.ts
│   ├── template.ts
│   ├── media.ts
│   └── index.ts
├── src/main/services/     # 业务服务层
│   ├── ai-recommend.ts
│   ├── backup.ts
│   └── export.ts
├── src/renderer/components/board/
│   ├── OutlineView.tsx    # 大纲视图（新增）
│   └── TimelineView.tsx   # 时间线视图（新增）
├── src/renderer/hooks/    # 自定义 Hooks
│   ├── useAudioRecorder.ts
│   ├── useAutoSave.ts
│   ├── useKeyboardShortcuts.ts
│   ├── useMarkdownWordCount.ts
│   ├── useSearch.ts
│   └── useTheme.ts
├── src/renderer/public/cursors/ # 自定义光标资源
└── src/renderer/styles/
    ├── themes/morandi-cool.css
    ├── themes/morandi-nature.css
    └── components/animations.css
```

---

## [2026-04-20] 全面修复与重构

### 🐛 基础设施与数据层修复

- **数据库 Schema 重写** - 修复 `creativities`、`boards`、`tags`、`templates`、`settings` 表结构，确保与前端类型和 IPC handler 一致
- **设置持久化修复** - 在 App 启动时调用 `loadSettings()`，确保设置在重启后保持
- **侧边栏收起遮挡修复** - 修复 `.sidebar-closed` 样式，确保主内容无遮挡
- **连接菜单 IPC 事件** - 添加 `onMenuEvent` 方法，确保所有菜单快捷键正常工作
- **统计图表不显示修复** - 创建 `Stats.tsx` 包装组件，增强 `creativity:stats` 返回数据
- **uiStore 缺失属性修复** - 添加 `shortcutGuideOpen` 和 `setShortcutGuideOpen` 属性
- **双套 IPC 系统** - 保留并增强 `index.ts` 内联 handler，补全所有缺失的 IPC Handler

### ✨ 核心功能实现

- **导出/导入功能** - 实现 `export:html`、`export:markdown`、`file:select`、`file:save` 接口
- **隐私锁功能** - 实现锁屏 UI + 密码验证，启动时检查隐私锁状态
- **撤销/重做** - 实现编辑菜单 undo/redo 功能
- **回收站功能** - 实现创意软删除到回收站，支持恢复和永久删除
- **缩放控制** - 实现菜单缩放和快捷键 Ctrl+/Ctrl-/Ctrl+0 功能
- **搜索页改进** - 无输入显示全部创意，添加排序控件

### 🎨 UI 优化与功能完善

- **重新设计"关于"弹窗** - 替换系统默认弹窗为自定义精美弹窗
- **实现快捷键速查弹窗** - 添加网格布局快捷键列表，支持 Ctrl+/ 打开
- **搜索改为弹窗模式** - 实现大弹窗搜索，支持 Shift/Ctrl 多选+拖拽到看板
- **优化创意编辑器 UI** - 改为居中模态弹窗，优化布局和视觉层次
- **修复媒体文件预览** - 增强图片/音视频渲染，支持本地文件，注册 `media://` 自定义协议
- **移除重复按钮** - 移除右上角录入按钮，搜索按钮改为打开弹窗
- **添加"新增看板"按钮** - 看板列表底部添加新增按钮+创建弹窗
- **模板系统** - 添加 `seedTemplates()` 插入默认模板，实现"存为模板"功能
- **添加右键菜单** - 首页/搜索页创意列表添加右键操作菜单
- **统计空状态居中** - 确保无数据时空状态提示居中

### 🚀 高级功能与最终完善

- **完善备份功能** - 重写 BackupSettings，支持倒计时提示、路径自定义、手动备份/恢复
- **修复统计卡片响应式** - 改为 `repeat(auto-fit, minmax(200px, 1fr))`，确保卡片自动换行
- **增强创意可选性** - 添加灵感提示词列表，增加更多卡片样式选项
- **补全所有缺失的 IPC Handler** - 添加 `creativity:batch-update`、`tag:read/update/assign/unassign`、`media:read/delete/thumbnail`、`board:add-creativity/remove-creativity` 等接口

### 🏗️ 看板板块重构

- **六视图新定位** -
  - 画布：核心创作区，初始空白，支持拖拽/右键/按钮导入创意，自由连线，框选打包
  - 看板：便利贴墙，成品展示，支持自由拖拽排列，拆包回画布
  - 图谱：专业思维导图，树形布局，支持拖拽连线+点击关联，子树发送到画布
  - 文件夹：全量浏览+自定义分类，支持自动分组+自定义文件夹，覆盖分类到其他看板
  - 大纲（新增）：树形大纲展示，适合文本类内容组织
  - 时间线（新增）：时间轴展示，按时间排序创意

---

## 变更记录规范

### 格式

```
## [日期] 版本/主题

### 🐛 Bug 修复
- 修复内容

### ✨ 功能新增
- 新功能描述

### 🎨 UI 优化
- 优化内容

### 🔧 技术改进
- 改进内容

### 🏗️ 架构变更
- 变更内容
```

### 类型标识

- 🐛 Bug 修复：修复已知问题
- ✨ 功能新增：新增功能
- 🎨 UI 优化：用户界面改进
- 🔧 技术改进：技术层面优化
- 🏗️ 架构变更：架构层面变更
- 📝 文档更新：文档相关更新

---

## 注意事项

1. **每次代码提交**：请同步更新对应的文档
2. **接口变更**：修改 IPC 接口时，请同步更新 `docs/api.md`
3. **架构变更**：架构层面的变更，请同步更新 `docs/architecture.md`
4. **功能变更**：所有 bug 修复和功能变更，请同步更新 `CHANGELOG.md`
5. **版本管理**：后续版本请按照语义化版本规范进行管理

---

> 本文档由文档工程师专用窗口维护，确保所有变更都有完整记录。

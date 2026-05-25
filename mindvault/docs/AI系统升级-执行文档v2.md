# AI 系统升级 - 技术执行文档（v2.0）

> **版本**：v2.0  
> **日期**：2026年5月24日  
> **状态**：待执行  
> **变更说明**：删除全局记忆功能，替换为"规则系统"；动态上下文压缩改为基于模型上下文窗口

---

## 一、升级概要

### 1.1 变更内容

| 变更项 | v1.0 方案 | v2.0 方案 | 原因 |
|--------|-----------|-----------|------|
| **全局记忆** | 保留并优化 | **删除** | 费钱、效果不稳定、用户无法控制 |
| **规则系统** | 无 | **新增** | 用户自行填写提示词作为规则，零成本、完全可控 |
| **上下文压缩** | 固定阈值（30条消息） | **基于模型上下文窗口动态调整** | 不同模型上下文上限不同，应动态适配 |
| **对话摘要** | 新建 conversation_summaries 表 | **复用已有 compact 系统** | 项目已有完整的5级压缩管线，无需重复造轮 |

### 1.2 升级后架构

```
升级前：
  消息历史 + 全局记忆（AI自动提取，费钱）

升级后：
  消息历史 + 动态压缩（已有） + 规则系统（新增，用户自定义）
```

---

## 二、模块一：删除全局记忆

### 2.1 需要删除的文件

| 文件 | 说明 |
|------|------|
| `src/main/services/ai-memory-sqlite.ts` | 全局记忆服务（SQLite版） |
| `src/main/ipc/ai-memory.ts` | 全局记忆IPC处理器 |

### 2.2 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/main/ipc/index.ts` | 删除 `registerAIMemoryHandlers` 的引用和注册 |
| `src/main/db/repository.ts` | 删除 `ai_memories` 表的创建（如果有的话） |
| `src/main/services/ai-service.ts` | 删除 `extractMemories` 和 `getRelevantMemories` 的调用 |
| `src/renderer/stores/aiStore.ts` | 删除记忆相关的 state 和 actions |
| `src/renderer/` | 删除记忆管理相关的前端组件（如果有） |

### 2.3 需要清理的数据库表

```sql
-- 如果确认不再需要，可以删除（建议先备份）
DROP TABLE IF EXISTS ai_memories;
```

### 2.4 注意事项

- 全局记忆功能删除后，AI 将不再自动"记住"跨对话的信息
- 这部分能力由新的"规则系统"替代（用户主动填写，而非AI自动提取）
- 如果用户之前有重要的全局记忆数据，建议在删除前提供导出功能

---

## 三、模块二：规则系统（新增）

### 3.1 设计参考

参考 Trae IDE 的 Rules 系统：`https://docs.trae.cn/ide/rules`

### 3.2 核心概念

**规则 = 用户自定义的提示词**，在每次 AI 对话时自动注入到 System Prompt 中。

与全局记忆的区别：

| 对比项 | 全局记忆（旧） | 规则系统（新） |
|--------|---------------|---------------|
| 谁创建 | AI 自动提取 | **用户手动填写** |
| 费用 | 每次对话都调用AI提取 | **零成本** |
| 准确性 | AI可能提取错误信息 | **用户自己说了算** |
| 可控性 | 用户看不到、管不了 | **完全可控** |
| 跨对话 | 自动共享 | 自动共享 |

### 3.3 规则类型

参考 Trae，支持两种规则：

| 规则类型 | 说明 | 示例 |
|----------|------|------|
| **全局规则** | 所有对话都生效 | "所有回答使用中文"、"我喜欢简洁的回答风格" |
| **项目规则** | 仅特定对话/场景生效 | "写小说时使用第三人称"、"讨论代码时给出详细注释" |

### 3.4 规则生效方式

| 生效方式 | 说明 | 适用场景 |
|----------|------|----------|
| **始终生效** | 所有对话都注入此规则 | 通用偏好（语言、风格等） |
| **手动触发** | 用户在对话中通过 `#规则名` 引用 | 特定场景的临时规则 |

### 3.5 数据库设计

```sql
CREATE TABLE IF NOT EXISTS ai_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                  -- 规则名称
  content TEXT NOT NULL,               -- 规则内容（Markdown格式）
  type TEXT NOT NULL DEFAULT 'global', -- 'global' 或 'project'
  scope TEXT DEFAULT NULL,             -- 生效范围（预留，用于项目级规则）
  apply_mode TEXT DEFAULT 'always',    -- 'always'（始终生效）或 'manual'（手动触发）
  description TEXT DEFAULT NULL,       -- 规则描述（用于手动触发时的展示）
  sort_order INTEGER DEFAULT 0,        -- 排序权重（数字越小越靠前）
  enabled INTEGER DEFAULT 1,           -- 是否启用
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_rules_type ON ai_rules(type);
CREATE INDEX IF NOT EXISTS idx_ai_rules_enabled ON ai_rules(enabled);
```

### 3.6 后端服务

**文件**：`src/main/services/ai-rules.ts`

```typescript
// 核心方法

/**
 * 获取所有生效的规则
 * 构建上下文时调用
 */
function getActiveRules(type?: 'global' | 'project'): Rule[]

/**
 * 获取规则列表（管理用）
 */
function getRules(options?: { type?: string, enabled?: boolean }): Rule[]

/**
 * 创建规则
 */
function createRule(rule: CreateRuleInput): Rule

/**
 * 更新规则
 */
function updateRule(id: string, updates: Partial<Rule>): Rule | null

/**
 * 删除规则
 */
function deleteRule(id: string): boolean

/**
 * 将规则注入到 System Prompt
 * 返回增强后的 System Prompt
 */
function injectRules(systemPrompt: string, rules: Rule[]): string
```

### 3.7 IPC 处理器

**文件**：`src/main/ipc/ai-rules.ts`

```typescript
// IPC 通道
'ai:rules:list'          // 获取规则列表
'ai:rules:create'        // 创建规则
'ai:rules:update'        // 更新规则
'ai:rules:delete'        // 删除规则
'ai:rules:toggle'        // 启用/禁用规则
'ai:rules:get-active'    // 获取当前生效的规则（构建上下文用）
```

### 3.8 前端界面

**文件**：`src/renderer/components/AIRulesPanel.tsx`

#### 界面设计

```
┌─────────────────────────────────────────────────────────┐
│  📋 AI 规则管理                              [+ 新建规则] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ 全局规则 ────────────────────────────────────────┐  │
│  │                                                   │  │
│  │  ✅ 语言偏好                        [始终生效]    │  │
│  │     所有回答使用中文表述，避免使用英文术语           │  │
│  │     [编辑] [禁用] [删除]                           │  │
│  │                                                   │  │
│  │  ✅ 写作风格                        [始终生效]    │  │
│  │     写小说时使用第三人称，注重氛围描写和人物心理     │  │
│  │     [编辑] [禁用] [删除]                           │  │
│  │                                                   │  │
│  │  ⬜ 代码规范                        [手动触发]    │  │
│  │     生成代码时使用 TypeScript，添加中文注释          │  │
│  │     [编辑] [启用] [删除]                           │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  💡 提示：手动触发的规则可在对话中通过 #规则名 引用      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 新建/编辑规则弹窗

```
┌─────────────────────────────────────────────────────────┐
│  新建规则                                           [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  规则名称：[________________]                            │
│                                                         │
│  生效方式：  ○ 始终生效  ○ 手动触发（#规则名 引用）       │
│                                                         │
│  规则内容：                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 支持Markdown格式                                 │    │
│  │                                                 │    │
│  │ 例如：                                          │    │
│  │ - 所有回答使用中文                               │    │
│  │ - 写小说时注重氛围描写                           │    │
│  │ - 讨论技术时给出代码示例                         │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│                              [取消]  [保存]              │
└─────────────────────────────────────────────────────────┘
```

### 3.9 规则注入逻辑

```typescript
// context-builder.ts（修改已有或新建）

function buildSystemPrompt(basePrompt: string, config: AIConfig): string {
  let prompt = basePrompt;

  // 1. 注入始终生效的规则
  const alwaysRules = getActiveRules('global').filter(r => r.apply_mode === 'always');
  
  if (alwaysRules.length > 0) {
    prompt += '\n\n## 用户规则（请严格遵守）\n';
    for (const rule of alwaysRules) {
      prompt += `\n### ${rule.name}\n${rule.content}\n`;
    }
  }

  // 2. 注入手动触发的规则（如果用户在消息中引用了 #规则名）
  // 在消息预处理阶段检测 #RuleName 引用，匹配后注入对应规则

  return prompt;
}
```

---

## 四、模块三：动态上下文压缩（优化已有）

### 4.1 现状分析

项目已有完整的 compact 压缩系统（`query-engine/compact/compact.ts`）：

| 特性 | 现状 |
|------|------|
| 压缩阈值 | 固定 100k tokens（AUTO_COMPACT_THRESHOLD） |
| 响应式阈值 | 固定 150k tokens（REACTIVE_COMPACT_THRESHOLD） |
| 压缩策略 | 5级压缩管线 + 9阶段结构化摘要 |
| Token估算 | `estimateTokens()` 函数 |

### 4.2 问题

当前阈值是**硬编码的固定值**（100k/150k），但不同模型的上下文窗口差异很大：

| 模型 | 上下文窗口 | 当前阈值是否合理 |
|------|-----------|-----------------|
| GPT-4o | 128k | ⚠️ 100k太接近上限 |
| GPT-4o-mini | 128k | ⚠️ 同上 |
| Claude 3.5 Sonnet | 200k | ✅ 合理 |
| Claude 3 Opus | 200k | ✅ 合理 |
| DeepSeek V3 | 64k | ❌ 100k已超出 |
| DeepSeek Chat | 32k | ❌ 严重超出 |

### 4.3 优化方案：基于模型动态计算阈值

```typescript
// 模型上下文窗口配置
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16384,
  // Anthropic
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,
  'deepseek-v4': 1000000,        // DeepSeek V4 Pro: 100万 tokens
  'deepseek-v4-pro': 1000000,    // DeepSeek V4 Pro: 100万 tokens
  // 默认值
  'default': 128000,
};

/**
 * 根据模型获取上下文窗口大小
 */
function getModelContextWindow(modelName: string): number {
  // 模糊匹配模型名称
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (modelName.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  return MODEL_CONTEXT_WINDOWS['default'];
}

/**
 * 根据模型动态计算压缩阈值
 * 策略：上下文窗口的 60% 触发自动压缩，80% 触发响应式压缩
 */
function getCompactThresholds(modelName: string): {
  autoCompactThreshold: number;
  reactiveCompactThreshold: number;
} {
  const contextWindow = getModelContextWindow(modelName);
  return {
    autoCompactThreshold: Math.floor(contextWindow * 0.6),   // 60%
    reactiveCompactThreshold: Math.floor(contextWindow * 0.8), // 80%
  };
}
```

### 4.4 修改点

| 文件 | 修改内容 |
|------|----------|
| `src/main/services/query-engine/compact/compact.ts` | 将硬编码阈值改为动态计算 |
| `src/main/services/query-engine/QueryEngine.ts` | 传入当前模型名称，动态获取阈值 |
| `src/main/services/ai-service.ts` | 在调用 compact 时传入模型信息 |

### 4.5 压缩流程（已有，无需修改逻辑）

```
用户发送消息
    ↓
估算当前消息总 token 数
    ↓
├─ token < 60% 上下文窗口 → 正常发送
├─ token > 60% 上下文窗口 → 自动压缩（压缩到50%）
└─ token > 80% 上下文窗口 → 响应式压缩（压缩到30%，更激进）
    ↓
压缩后发送给AI
```

---

## 五、修改文件清单

### 5.1 删除的文件

| 文件 | 原因 |
|------|------|
| `src/main/services/ai-memory-sqlite.ts` | 全局记忆服务，被规则系统替代 |
| `src/main/ipc/ai-memory.ts` | 全局记忆IPC处理器 |

### 5.2 新增的文件

| 文件 | 说明 |
|------|------|
| `src/main/services/ai-rules.ts` | 规则服务（CRUD + 注入） |
| `src/main/ipc/ai-rules.ts` | 规则IPC处理器 |
| `src/renderer/components/AIRulesPanel.tsx` | 规则管理面板 |
| `src/renderer/components/RuleEditorDialog.tsx` | 新建/编辑规则弹窗 |

### 5.3 修改的文件

| 文件 | 修改内容 |
|------|----------|
| `src/main/ipc/index.ts` | 删除记忆处理器引用，注册规则处理器 |
| `src/main/db/repository.ts` | 删除 ai_memories 表创建，新增 ai_rules 表创建 |
| `src/main/services/ai-service.ts` | 删除记忆相关调用，集成规则注入 |
| `src/main/services/query-engine/compact/compact.ts` | 硬编码阈值 → 动态计算 |
| `src/main/services/query-engine/QueryEngine.ts` | 传入模型名称用于动态阈值 |
| `src/renderer/stores/aiStore.ts` | 删除记忆相关state，新增规则相关state |

---

## 六、执行步骤

### Phase 1：清理全局记忆（工作量：小）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 1.1 | 删除 `ai-memory-sqlite.ts` 和 `ipc/ai-memory.ts` | 无 |
| 1.2 | 修改 `ipc/index.ts` 移除记忆处理器注册 | 1.1 |
| 1.3 | 修改 `ai-service.ts` 移除记忆相关调用 | 1.1 |
| 1.4 | 修改 `repository.ts` 清理记忆表 | 1.1 |
| 1.5 | 修改前端 aiStore 清理记忆相关代码 | 1.1 |

### Phase 2：实现规则系统（工作量：中等）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 2.1 | 创建 `ai_rules` 表 | Phase 1 |
| 2.2 | 实现 `ai-rules.ts` 规则服务 | 2.1 |
| 2.3 | 实现 `ipc/ai-rules.ts` IPC处理器 | 2.2 |
| 2.4 | 修改 `ai-service.ts` 集成规则注入 | 2.2 |
| 2.5 | 实现 `AIRulesPanel.tsx` 规则管理面板 | 2.3 |
| 2.6 | 实现 `RuleEditorDialog.tsx` 规则编辑弹窗 | 2.5 |
| 2.7 | 在设置页面嵌入规则管理入口 | 2.5 |

### Phase 3：优化动态压缩（工作量：小）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 3.1 | 在 `compact.ts` 中添加模型上下文窗口配置 | 无 |
| 3.2 | 实现动态阈值计算函数 | 3.1 |
| 3.3 | 修改 `QueryEngine.ts` 传入模型名称 | 3.2 |
| 3.4 | 测试不同模型的压缩触发时机 | 3.3 |

### Phase 4：测试（工作量：小）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 4.1 | 测试规则 CRUD 操作 | Phase 2 |
| 4.2 | 测试规则注入到 System Prompt | Phase 2 |
| 4.3 | 测试手动触发规则（#规则名） | Phase 2 |
| 4.4 | 测试不同模型的动态压缩阈值 | Phase 3 |
| 4.5 | 回归测试：确保删除记忆后AI对话正常 | Phase 1 |

---

## 七、配置参数汇总

### 7.1 规则系统参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MAX_RULES_COUNT` | 20 | 最大规则数量 |
| `MAX_RULE_CONTENT_LENGTH` | 2000 | 单条规则最大字符数 |
| `MAX_INJECTED_RULES_TOKENS` | 2000 | 注入规则的最大 token 数 |

### 7.2 动态压缩参数

| 参数 | 计算方式 | 说明 |
|------|----------|------|
| `autoCompactThreshold` | 模型上下文窗口 × 60% | 自动压缩触发点 |
| `reactiveCompactThreshold` | 模型上下文窗口 × 80% | 响应式压缩触发点 |
| `autoCompactRatio` | 0.5 | 自动压缩目标比例 |
| `reactiveCompactRatio` | 0.3 | 响应式压缩目标比例 |

### 7.3 模型上下文窗口配置

| 模型 | 上下文窗口 | 自动压缩阈值 | 响应式压缩阈值 |
|------|-----------|-------------|---------------|
| GPT-4o / GPT-4o-mini | 128k | 76,800 | 102,400 |
| GPT-3.5-turbo | 16k | 9,600 | 12,800 |
| Claude 3.5 Sonnet | 200k | 120,000 | 160,000 |
| Claude 3 Opus | 200k | 120,000 | 160,000 |
| DeepSeek Chat | 64k | 38,400 | 51,200 |
| DeepSeek V4 Pro | 1000k | 600,000 | 800,000 |
| 默认 | 128k | 76,800 | 102,400 |

---

## 八、风险与注意事项

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 删除全局记忆后用户数据丢失 | 用户之前积累的记忆消失 | 删除前提供导出功能，或保留表但停止使用 |
| 规则注入过多导致 System Prompt 过长 | 挤占对话上下文空间 | 限制规则总 token 数，超出时截断或警告 |
| 动态压缩阈值计算不准确 | 压缩过早或过晚 | 提供配置覆盖，允许用户手动调整 |
| 模型名称匹配失败 | 使用默认阈值 | 默认值设为保守值（128k），覆盖大多数模型 |

---

*文档结束*

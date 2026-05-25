# RAG 系统升级 - 技术执行文档

> **版本**：v1.0  
> **日期**：2026年5月25日  
> **状态**：待执行

---

## 一、需求汇总

| 维度 | 选择 | 说明 |
|------|------|------|
| 索引触发 | 自动索引 | 数据变更时自动更新向量索引 |
| 检索范围 | 全覆盖 | 创意、看板、卡片、写作章节、标签、分类 |
| Embedding模型 | 多模型（优先DeepSeek） | DeepSeek → OpenAI → 关键词回退 |
| 检索触发 | 自动+AI主动 | 自动检索注入 + AI可主动调用工具 |
| 数据权限 | 全部数据 | 含回收站内容 |
| 结果展示 | 注入+展示 | 注入Prompt + 界面显示引用来源 |
| 索引管理 | 完整面板 | 埋在深处的管理窗口 |
| 分块策略 | 智能分块 | 短内容不分块，长内容按段落 |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户操作                                  │
│  创建/修改/删除 创意、看板、卡片、章节、标签...                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ 自动触发
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    索引服务 (rag-indexer.ts)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ 数据变更监听 │→│ 智能分块    │→│ 向量化      │              │
│  └─────────────┘  └─────────────┘  └──────┬──────┘              │
│                                           │                      │
│                    ┌──────────────────────┼────────────────────┐ │
│                    ▼                      ▼                    ▼ │
│              DeepSeek API          OpenAI API           关键词  │
│              (优先)                (备选)               (兜底)  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SQLite 向量存储 (rag_embeddings)               │
│  source_type | source_id | chunk_index | content | embedding   │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    检索服务 (rag-search.ts)                      │
│                                                                 │
│  用户提问 ──→ 向量化 ──→ 相似度计算 ──→ 返回相关内容             │
│                    │                                            │
│                    ▼                                            │
│              ┌─────────────────────────────────────┐            │
│              │ 自动注入到 System Prompt            │            │
│              │ + 界面显示引用来源                   │            │
│              └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据源覆盖

| 数据源 | 表名 | 触发事件 | 优先级 |
|--------|------|----------|--------|
| 创意内容 | `creativities` | create/update/delete/restore | P0 |
| 看板卡片 | `boards` + `cards` | create/update/delete | P1 |
| 写作章节 | `writing_chapters` | create/update/delete | P1 |
| 标签 | `tags` | create/update/delete | P2 |
| 分类 | `categories` | create/update/delete | P2 |

### 2.3 Embedding 模型优先级

```
1. DeepSeek Embedding API (优先)
   - 模型: deepseek-embedding
   - 维度: 1536
   - 成本: 低
   
2. OpenAI Embedding API (备选)
   - 模型: text-embedding-3-small
   - 维度: 1536
   - 成本: 中
   
3. 关键词匹配 (兜底)
   - 无需API
   - 成本: 零
```

---

## 三、数据库设计

### 3.1 修改现有表

```sql
-- rag_embeddings 表增加字段
ALTER TABLE rag_embeddings ADD COLUMN source_title TEXT;
ALTER TABLE rag_embeddings ADD COLUMN source_status TEXT DEFAULT 'active';
ALTER TABLE rag_embeddings ADD COLUMN embedding_model TEXT;
ALTER TABLE rag_embeddings ADD COLUMN indexed_at TEXT;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_rag_source_status ON rag_embeddings(source_status);
CREATE INDEX IF NOT EXISTS idx_rag_model ON rag_embeddings(embedding_model);
```

### 3.2 新增索引日志表

```sql
CREATE TABLE IF NOT EXISTS rag_index_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,           -- 'index' / 'delete' / 'rebuild'
  source_type TEXT NOT NULL,
  source_id TEXT,
  chunks_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,           -- 'success' / 'failed' / 'partial'
  error_message TEXT,
  duration_ms INTEGER,
  embedding_model TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_logs_created ON rag_index_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_logs_source ON rag_index_logs(source_type, source_id);
```

---

## 四、核心模块设计

### 4.1 模块一：Embedding 服务（重构）

**文件**：`src/main/services/rag-embedding.ts`

```typescript
// Embedding 模型配置
const EMBEDDING_MODELS = {
  deepseek: {
    name: 'deepseek-embedding',
    url: 'https://api.deepseek.com/v1/embeddings',
    dimension: 1536,
    maxTokens: 8191,
  },
  openai: {
    name: 'text-embedding-3-small',
    url: 'https://api.openai.com/v1/embeddings',
    dimension: 1536,
    maxTokens: 8191,
  },
};

// 获取 Embedding（优先 DeepSeek）
async function getEmbedding(text: string, config: AIConfig): Promise<{
  embedding: number[];
  model: string;
}> {
  // 1. 尝试 DeepSeek
  if (config.deepseekApiKey) {
    try {
      const embedding = await getEmbeddingFromDeepSeek(text, config.deepseekApiKey);
      return { embedding, model: 'deepseek' };
    } catch (err) {
      console.warn('[RAG] DeepSeek Embedding 失败:', err.message);
    }
  }
  
  // 2. 尝试 OpenAI
  if (config.openaiApiKey) {
    try {
      const embedding = await getEmbeddingFromOpenAI(text, config.openaiApiKey, config.openaiBaseUrl);
      return { embedding, model: 'openai' };
    } catch (err) {
      console.warn('[RAG] OpenAI Embedding 失败:', err.message);
    }
  }
  
  // 3. 返回 null，使用关键词匹配
  return { embedding: null, model: 'keyword' };
}
```

### 4.2 模块二：智能分块服务

**文件**：`src/main/services/rag-chunker.ts`

```typescript
// 智能分块策略
function smartChunk(content: string, options?: {
  maxChunkSize?: number;
  minChunkSize?: number;
}): Chunk[] {
  const { maxChunkSize = 500, minChunkSize = 50 } = options || {};
  
  // 短内容不分块
  if (content.length <= maxChunkSize) {
    return [{ text: content, type: 'full' }];
  }
  
  // 按段落分块
  const paragraphs = content.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let current = '';
  
  for (const para of paragraphs) {
    if (current.length + para.length > maxChunkSize && current.length >= minChunkSize) {
      chunks.push({ text: current.trim(), type: 'paragraph' });
      current = para;
    } else {
      current += '\n\n' + para;
    }
  }
  
  if (current.trim()) {
    chunks.push({ text: current.trim(), type: 'paragraph' });
  }
  
  return chunks;
}
```

### 4.3 模块三：数据变更监听

**文件**：`src/main/services/rag-watcher.ts`

```typescript
// 监听数据变更，自动触发索引
function setupRagWatcher() {
  // 创意变更
  ipcMain.on('creativity:created', (event, data) => {
    queueIndexJob('creativity', data.id, 'index');
  });
  
  ipcMain.on('creativity:updated', (event, data) => {
    queueIndexJob('creativity', data.id, 'reindex');
  });
  
  ipcMain.on('creativity:deleted', (event, id) => {
    queueIndexJob('creativity', id, 'delete');
  });
  
  ipcMain.on('creativity:restored', (event, id) => {
    queueIndexJob('creativity', id, 'index');
  });
  
  // 看板/卡片变更
  ipcMain.on('board:created', ...);
  ipcMain.on('card:created', ...);
  
  // 写作章节变更
  ipcMain.on('chapter:created', ...);
  
  // 标签/分类变更
  ipcMain.on('tag:created', ...);
}

// 索引任务队列（防抖 + 批量处理）
const indexQueue = new Map<string, IndexJob>();

function queueIndexJob(sourceType: string, sourceId: string, action: string) {
  const key = `${sourceType}:${sourceId}`;
  indexQueue.set(key, { sourceType, sourceId, action, timestamp: Date.now() });
  
  // 延迟处理，合并短时间内的多次变更
  setTimeout(() => processQueue(), 1000);
}
```

### 4.4 模块四：检索服务（增强）

**文件**：`src/main/services/rag-search.ts`

```typescript
// 检索入口（自动调用）
async function searchForContext(
  query: string, 
  config: AIConfig,
  options?: SearchOptions
): Promise<SearchResult[]> {
  const { limit = 5, sourceTypes, includeTrash = true } = options || {};
  
  // 1. 获取查询向量
  const { embedding, model } = await getEmbedding(query, config);
  
  // 2. 构建查询
  let sql = `
    SELECT * FROM rag_embeddings 
    WHERE 1=1
    ${!includeTrash ? "AND source_status = 'active'" : ''}
    ${sourceTypes ? `AND source_type IN (${sourceTypes.map(() => '?').join(',')})` : ''}
  `;
  
  // 3. 向量检索或关键词匹配
  const results = embedding 
    ? await vectorSearch(sql, embedding, limit)
    : await keywordSearch(sql, query, limit);
  
  // 4. 记录检索日志
  logSearch(query, model, results.length);
  
  return results;
}

// 格式化检索结果用于注入 Prompt
function formatForPrompt(results: SearchResult[]): string {
  if (results.length === 0) return '';
  
  let text = '\n\n## 相关内容（来自你的知识库）\n';
  
  for (const r of results) {
    text += `\n### ${r.sourceTitle || r.sourceType} (相关度: ${Math.round(r.score * 100)}%)\n`;
    text += r.contentChunk + '\n';
  }
  
  return text;
}
```

### 4.5 模块五：检索结果展示组件

**文件**：`src/renderer/components/RAGReferencePanel.tsx`

```tsx
// 在聊天界面显示引用来源
const RAGReferencePanel: React.FC<{ references: SearchResult[] }> = ({ references }) => {
  if (!references || references.length === 0) return null;
  
  return (
    <div className="rag-references">
      <div className="rag-header">
        <BookOutlined /> 已检索到 {references.length} 条相关内容
      </div>
      <div className="rag-list">
        {references.map((ref, i) => (
          <div key={i} className="rag-item">
            <Tag color="blue">{ref.sourceType}</Tag>
            <span className="rag-title">{ref.sourceTitle}</span>
            <span className="rag-score">{Math.round(ref.score * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 4.6 模块六：索引管理面板

**文件**：`src/renderer/components/RAGManagementPanel.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 RAG 知识库管理                                    [刷新]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 索引状态                                                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 数据源        │ 已索引    │ 总数      │ 最后更新          │ │
│  ├───────────────┼───────────┼───────────┼───────────────────┤ │
│  │ 创意内容      │ 42        │ 45        │ 2026-05-25 00:13  │ │
│  │ 看板卡片      │ 18        │ 20        │ 2026-05-25 00:10  │ │
│  │ 写作章节      │ 7         │ 7         │ 2026-05-24 23:45  │ │
│  │ 标签          │ 35        │ 35        │ 2026-05-24 23:40  │ │
│  └───────────────┴───────────┴───────────┴───────────────────┘ │
│                                                                 │
│  ⚙️ Embedding 模型: DeepSeek (当前)                            │
│  📈 向量维度: 1536                                              │
│  💾 存储大小: 2.3 MB                                            │
│                                                                 │
│  [🔄 重建全部索引]  [🗑️ 清空索引]  [📋 查看日志]               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  📋 索引日志 (最近10条)                              [查看全部] │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 时间              │ 操作     │ 数据源    │ 状态    │ 耗时  │ │
│  ├───────────────────┼──────────┼───────────┼─────────┼───────┤ │
│  │ 00:13:25         │ 索引     │ 创意      │ ✅ 成功 │ 1.2s  │ │
│  │ 00:10:15         │ 索引     │ 看板      │ ✅ 成功 │ 0.8s  │ │
│  │ 23:45:30         │ 删除     │ 章节      │ ✅ 成功 │ 0.1s  │ │
│  └───────────────────┴──────────┴───────────┴─────────┴───────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、修改文件清单

### 5.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/main/services/rag-embedding.ts` | 多模型 Embedding 服务 |
| `src/main/services/rag-chunker.ts` | 智能分块服务 |
| `src/main/services/rag-watcher.ts` | 数据变更监听 |
| `src/main/services/rag-search.ts` | 增强检索服务 |
| `src/main/ipc/rag-management.ts` | 索引管理 IPC |
| `src/renderer/components/RAGReferencePanel.tsx` | 引用来源展示 |
| `src/renderer/components/RAGManagementPanel.tsx` | 索引管理面板 |

### 5.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/main/services/rag-service.ts` | 重构为调用新模块 |
| `src/main/db/schema.sql` | 新增字段和日志表 |
| `src/main/ipc/index.ts` | 注册新的 IPC 处理器 |
| `src/main/services/creativity-service.ts` | 添加索引触发 |
| `src/main/services/board-service.ts` | 添加索引触发 |
| `src/main/services/writing-service.ts` | 添加索引触发 |
| `src/main/services/query-engine/QueryEngine.ts` | 集成自动检索 |
| `src/renderer/components/ai/AIChatFullscreen.tsx` | 添加引用来源展示 |
| `src/renderer/pages/Settings.tsx` | 添加管理面板入口 |

---

## 六、执行步骤

### Phase 1：核心服务重构（优先）

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 1.1 | 实现 `rag-embedding.ts` 多模型支持 | 无 |
| 1.2 | 实现 `rag-chunker.ts` 智能分块 | 无 |
| 1.3 | 重构 `rag-service.ts` 调用新模块 | 1.1, 1.2 |
| 1.4 | 更新数据库 schema | 无 |

### Phase 2：自动索引

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 2.1 | 实现 `rag-watcher.ts` 数据变更监听 | Phase 1 |
| 2.2 | 修改 creativity-service 添加索引触发 | 2.1 |
| 2.3 | 修改 board-service 添加索引触发 | 2.1 |
| 2.4 | 修改 writing-service 添加索引触发 | 2.1 |

### Phase 3：检索增强

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 3.1 | 实现 `rag-search.ts` 增强检索 | Phase 1 |
| 3.2 | 修改 QueryEngine 集成自动检索 | 3.1 |
| 3.3 | 实现 `RAGReferencePanel.tsx` 引用展示 | 3.1 |

### Phase 4：管理界面

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 4.1 | 实现 `rag-management.ts` IPC | Phase 2 |
| 4.2 | 实现 `RAGManagementPanel.tsx` 管理面板 | 4.1 |
| 4.3 | 在设置页添加入口 | 4.2 |

### Phase 5：测试

| 步骤 | 任务 | 依赖 |
|------|------|------|
| 5.1 | 测试自动索引触发 | Phase 2 |
| 5.2 | 测试多模型 Embedding | Phase 1 |
| 5.3 | 测试检索注入和展示 | Phase 3 |
| 5.4 | 测试管理面板功能 | Phase 4 |

---

## 七、配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `RAG_AUTO_INDEX_ENABLED` | true | 是否启用自动索引 |
| `RAG_SEARCH_LIMIT` | 5 | 默认检索结果数量 |
| `RAG_MIN_SCORE` | 0.3 | 最低相似度阈值 |
| `RAG_MAX_CHUNK_SIZE` | 500 | 最大分块大小 |
| `RAG_MIN_CHUNK_SIZE` | 50 | 最小分块大小 |
| `RAG_EMBEDDING_PRIORITY` | ['deepseek', 'openai'] | Embedding 模型优先级 |

---

## 八、DeepSeek Embedding API 参考

```typescript
// DeepSeek Embedding API 调用
async function getEmbeddingFromDeepSeek(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.deepseek.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-embedding',
      input: text.substring(0, 8191),
    }),
  });
  
  const data = await response.json();
  return data.data[0].embedding;
}
```

---

*文档结束*

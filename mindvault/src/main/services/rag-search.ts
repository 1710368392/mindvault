// @ts-nocheck
/**
 * RAG 检索服务 - 增强版
 * 支持向量检索 + 关键词匹配，自动注入 Prompt
 */

const { getEmbedding, cosineSimilarity, keywordMatchScore } = require('./rag-embedding');
const repo = require('../db/repository');

function getDb() { return repo.db; }

// 默认配置
const SEARCH_CONFIG = {
  defaultLimit: 5,
  minScore: 0.3,
  includeTrash: true,
};

/**
 * 检索选项
 * @typedef {Object} SearchOptions
 * @property {number} limit - 返回结果数量
 * @property {string[]} sourceTypes - 数据源类型过滤
 * @property {boolean} includeTrash - 是否包含回收站内容
 * @property {number} minScore - 最低相似度阈值
 */

/**
 * 检索结果
 * @typedef {Object} SearchResult
 * @property {string} sourceType - 数据源类型
 * @property {string} sourceId - 数据源ID
 * @property {string} sourceTitle - 数据源标题
 * @property {string} sourceStatus - 数据源状态
 * @property {string} contentChunk - 内容分块
 * @property {number} chunkIndex - 分块索引
 * @property {number} score - 相似度分数
 * @property {string} embeddingModel - 使用的 Embedding 模型
 */

/**
 * 检索相关内容
 * @param {string} query - 查询文本
 * @param {object} config - AI 配置
 * @param {SearchOptions} options - 检索选项
 * @returns {Promise<SearchResult[]>}
 */
async function search(query, config, options = {}) {
  const db = getDb();
  if (!db) return [];

  const { limit = SEARCH_CONFIG.defaultLimit, sourceTypes, includeTrash = true, minScore = SEARCH_CONFIG.minScore } = options;

  console.log(`[RAG-Search] 开始检索: "${query.substring(0, 50)}..."`);

  // 1. 获取查询向量
  const { embedding: queryEmbedding, model } = await getEmbedding(query, config);
  console.log(`[RAG-Search] 使用模型: ${model}`);

  // 2. 构建查询（容错处理：source_status 列可能不存在）
  let sql = 'SELECT * FROM rag_embeddings WHERE 1=1';
  const params = [];

  // 检查 source_status 列是否存在
  let hasSourceStatus = false;
  try {
    const cols = db.prepare("PRAGMA table_info(rag_embeddings)").all().map((c: any) => c.name);
    hasSourceStatus = cols.includes('source_status');
  } catch (e) {
    console.warn('[RAG-Search] 检查列失败:', e.message);
  }

  if (!includeTrash && hasSourceStatus) {
    sql += " AND (source_status IS NULL OR source_status = 'active')";
  }

  if (sourceTypes && sourceTypes.length > 0) {
    sql += ` AND source_type IN (${sourceTypes.map(() => '?').join(',')})`;
    params.push(...sourceTypes);
  }

  let rows = [];
  try {
    rows = db.prepare(sql).all(...params);
  } catch (e) {
    console.error('[RAG-Search] 查询失败:', e.message);
    return [];
  }
  console.log(`[RAG-Search] 找到 ${rows.length} 个候选分块`);

  // 3. 计算相似度
  const results = rows.map(row => {
    let score = 0;

    // 向量相似度
    if (queryEmbedding && row.embedding) {
      try {
        const storedEmbedding = JSON.parse(row.embedding);
        score = cosineSimilarity(queryEmbedding, storedEmbedding);
      } catch (e) {
        console.warn('[RAG-Search] 解析向量失败:', e.message);
      }
    }

    // 关键词匹配（作为补充或兜底）
    if (score < minScore) {
      const keywordScore = keywordMatchScore(query, row.content_chunk || '');
      score = Math.max(score, keywordScore * 0.8); // 关键词匹配权重较低
    }

    return {
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceTitle: row.source_title,
      sourceStatus: row.source_status || 'active',
      contentChunk: row.content_chunk,
      chunkIndex: row.chunk_index,
      score,
      embeddingModel: row.embedding_model || model,
    };
  });

  // 4. 过滤并排序
  const filteredResults = results
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`[RAG-Search] 返回 ${filteredResults.length} 条结果`);

  return filteredResults;
}

/**
 * 格式化检索结果用于注入 Prompt
 * @param {SearchResult[]} results - 检索结果
 * @returns {string}
 */
function formatForPrompt(results) {
  if (!results || results.length === 0) return '';

  let text = '\n\n## 相关内容（来自你的知识库）\n';
  text += '> 以下内容是根据用户问题自动检索到的相关资料，可用于回答问题时参考。\n\n';

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const scorePercent = Math.round(r.score * 100);
    const typeLabel = getTypeLabel(r.sourceType);
    
    text += `### ${i + 1}. ${r.sourceTitle || typeLabel} (相关度: ${scorePercent}%)\n`;
    text += `**来源**: ${typeLabel}`;
    if (r.sourceStatus === 'trashed') {
      text += ' (已删除)';
    }
    text += '\n\n';
    text += r.contentChunk + '\n\n';
    text += '---\n\n';
  }

  return text;
}

/**
 * 获取数据源类型标签
 */
function getTypeLabel(sourceType) {
  const labels = {
    creativity: '创意',
    board: '看板',
    card: '卡片',
    chapter: '写作章节',
    tag: '标签',
    category: '分类',
  };
  return labels[sourceType] || sourceType;
}

/**
 * 按数据源分组检索结果
 */
function groupBySource(results) {
  const groups = new Map();

  for (const r of results) {
    const key = `${r.sourceType}:${r.sourceId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        sourceTitle: r.sourceTitle,
        sourceStatus: r.sourceStatus,
        chunks: [],
        maxScore: 0,
      });
    }
    const group = groups.get(key);
    group.chunks.push({
      index: r.chunkIndex,
      content: r.contentChunk,
      score: r.score,
    });
    group.maxScore = Math.max(group.maxScore, r.score);
  }

  return Array.from(groups.values()).sort((a, b) => b.maxScore - a.maxScore);
}

/**
 * 智能检索（结合上下文）
 * @param {string} query - 查询文本
 * @param {object} context - 上下文信息
 * @param {object} config - AI 配置
 * @param {SearchOptions} options - 检索选项
 */
async function smartSearch(query, context, config, options = {}) {
  // 基础检索
  const baseResults = await search(query, config, options);

  // 如果有上下文标签，额外检索相关标签内容
  if (context?.tags && context.tags.length > 0) {
    const tagQueries = context.tags.map(t => t.name || t).slice(0, 3);
    const tagResults = [];

    for (const tag of tagQueries) {
      const results = await search(tag, config, { ...options, limit: 2 });
      tagResults.push(...results);
    }

    // 合并结果，去重
    const allResults = [...baseResults];
    const existingIds = new Set(baseResults.map(r => `${r.sourceType}:${r.sourceId}:${r.chunkIndex}`));

    for (const r of tagResults) {
      const id = `${r.sourceType}:${r.sourceId}:${r.chunkIndex}`;
      if (!existingIds.has(id)) {
        allResults.push(r);
        existingIds.add(id);
      }
    }

    // 重新排序
    return allResults.sort((a, b) => b.score - a.score).slice(0, options.limit || 5);
  }

  return baseResults;
}

/**
 * 获取检索统计
 */
function getSearchStats() {
  const db = getDb();
  if (!db) return null;

  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM rag_embeddings').get().count;
    const withEmbedding = db.prepare("SELECT COUNT(*) as count FROM rag_embeddings WHERE embedding IS NOT NULL").get().count;
    const byType = db.prepare('SELECT source_type, COUNT(*) as count FROM rag_embeddings GROUP BY source_type').all();

    let byModel = [];
    try {
      byModel = db.prepare('SELECT embedding_model, COUNT(*) as count FROM rag_embeddings WHERE embedding_model IS NOT NULL GROUP BY embedding_model').all();
    } catch (e) {
      // embedding_model 列可能尚未迁移
      console.warn('[RAG-Search] 查询 embedding_model 失败，列可能尚未迁移:', e.message);
    }

    return {
      total,
      withEmbedding,
      withoutEmbedding: total - withEmbedding,
      byType: byType.reduce((acc, r) => ({ ...acc, [r.source_type]: r.count }), {}),
      byModel: byModel.reduce((acc, r) => ({ ...acc, [r.embedding_model]: r.count }), {}),
    };
  } catch (e) {
    console.error('[RAG-Search] 获取统计失败:', e.message);
    return { total: 0, withEmbedding: 0, withoutEmbedding: 0, byType: {}, byModel: {} };
  }
}

module.exports = {
  search,
  smartSearch,
  formatForPrompt,
  groupBySource,
  getTypeLabel,
  getSearchStats,
  SEARCH_CONFIG,
};

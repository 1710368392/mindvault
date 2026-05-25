// @ts-nocheck
/**
 * RAG 服务 - 主入口
 * 整合 Embedding、分块、检索模块
 * 支持多模型 Embedding（优先 DeepSeek）
 */

const crypto = require('crypto');
const repo = require('../db/repository');
const { getEmbedding, getAvailableModel, cosineSimilarity } = require('./rag-embedding');
const { smartChunk, getChunkStats } = require('./rag-chunker');
const { search, smartSearch, formatForPrompt, getSearchStats, SEARCH_CONFIG } = require('./rag-search');

function getDb() { return repo.db; }

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 索引内容
 * @param {string} sourceType - 数据源类型
 * @param {string} sourceId - 数据源ID
 * @param {string} content - 内容文本
 * @param {object} options - 选项
 * @param {object} config - AI 配置
 * @returns {Promise<{indexed: number, model: string}>}
 */
async function indexContent(sourceType, sourceId, content, options = {}, config = null) {
  const db = getDb();
  if (!db) throw new Error('数据库未初始化');

  const { 
    title = '', 
    status = 'active',
    forceReindex = false,
    chunkConfig = {} 
  } = options;

  console.log(`[RAG] 开始索引: ${sourceType}/${sourceId}`);

  // 1. 检查是否需要重新索引
  const contentHash = hashContent(content);
  if (!forceReindex) {
    const existing = db.prepare(
      'SELECT id, content_hash FROM rag_embeddings WHERE source_type = ? AND source_id = ? LIMIT 1'
    ).get(sourceType, sourceId);

    if (existing && existing.content_hash === contentHash) {
      console.log(`[RAG] 内容未变化，跳过索引: ${sourceType}/${sourceId}`);
      return { indexed: 0, model: 'skipped', reason: 'content_unchanged' };
    }
  }

  // 2. 删除旧索引
  db.prepare('DELETE FROM rag_embeddings WHERE source_type = ? AND source_id = ?')
    .run(sourceType, sourceId);

  // 3. 智能分块
  const chunks = smartChunk(content, chunkConfig);
  if (chunks.length === 0) {
    console.log(`[RAG] 内容为空，跳过索引: ${sourceType}/${sourceId}`);
    return { indexed: 0, model: 'empty', reason: 'empty_content' };
  }

  console.log(`[RAG] 分块完成: ${chunks.length} 个分块`);

  // 4. 获取当前可用的 Embedding 模型
  const modelInfo = getAvailableModel(config);
  const now = new Date().toISOString();
  let indexed = 0;
  let usedModel = 'keyword';

  // 5. 为每个分块生成 Embedding 并存储
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk.text.trim()) continue;

    let embedding = null;
    let embeddingModel = 'keyword';

    // 尝试获取 Embedding
    if (config) {
      try {
        const result = await getEmbedding(chunk.text, config);
        if (result.embedding) {
          embedding = JSON.stringify(result.embedding);
          embeddingModel = result.model;
          usedModel = result.model;
        }
      } catch (err) {
        console.warn(`[RAG] Embedding 生成失败 (chunk ${i}):`, err.message);
      }
    }

    // 存储到数据库
    try {
      db.prepare(`
        INSERT INTO rag_embeddings 
        (id, source_type, source_id, source_title, source_status, content_hash, content_chunk, embedding, embedding_model, chunk_index, indexed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        sourceType,
        sourceId,
        title,
        status,
        contentHash,
        chunk.text,
        embedding,
        embeddingModel,
        i,
        now,
        now,
        now
      );
    } catch (insertErr) {
      // 新列可能尚未迁移，尝试使用旧版 INSERT
      console.warn('[RAG] 新版写入失败，尝试旧版:', insertErr.message);
      try {
        db.prepare(`
          INSERT INTO rag_embeddings 
          (id, source_type, source_id, content_hash, content_chunk, embedding, chunk_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          generateId(),
          sourceType,
          sourceId,
          contentHash,
          chunk.text,
          embedding,
          i,
          now,
          now
        );
      } catch (fallbackErr) {
        console.error('[RAG] 索引写入失败:', fallbackErr.message);
        continue;
      }
    }

    indexed++;

    // 避免请求过快
    if (embedding && i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // 6. 记录索引日志
  logIndex('index', sourceType, sourceId, indexed, 'success', null, usedModel);

  console.log(`[RAG] 索引完成: ${indexed} 个分块, 模型: ${usedModel}`);

  return { indexed, model: usedModel, chunks: chunks.length };
}

/**
 * 删除索引
 */
function deleteIndex(sourceType, sourceId) {
  const db = getDb();
  if (!db) return 0;

  const result = db.prepare('DELETE FROM rag_embeddings WHERE source_type = ? AND source_id = ?')
    .run(sourceType, sourceId);

  logIndex('delete', sourceType, sourceId, result.changes, 'success');

  return result.changes;
}

/**
 * 更新索引状态（如移动到回收站）
 */
function updateIndexStatus(sourceType, sourceId, status) {
  const db = getDb();
  if (!db) return 0;

  try {
    const result = db.prepare(
      'UPDATE rag_embeddings SET source_status = ?, updated_at = ? WHERE source_type = ? AND source_id = ?'
    ).run(status, new Date().toISOString(), sourceType, sourceId);
    return result.changes;
  } catch (e) {
    // source_status 列可能尚未迁移
    console.warn('[RAG] 更新索引状态失败:', e.message);
    return 0;
  }
}

/**
 * 批量索引创意
 */
async function indexAllCreativities(config, options = {}) {
  const db = getDb();
  if (!db) return { total: 0, indexed: 0, failed: 0 };

  const { includeTrashed = false } = options;
  
  let sql = "SELECT id, title, content, status FROM creativities WHERE content != ''";
  if (!includeTrashed) {
    sql += " AND status != 'trashed'";
  }
  
  const creativities = db.prepare(sql).all();
  console.log(`[RAG] 开始批量索引 ${creativities.length} 个创意`);

  let totalIndexed = 0;
  let failed = 0;

  for (const c of creativities) {
    try {
      const fullContent = `${c.title}\n\n${c.content}`;
      const result = await indexContent('creativity', c.id, fullContent, {
        title: c.title,
        status: c.status,
      }, config);
      
      totalIndexed += result.indexed;
    } catch (err) {
      console.warn(`[RAG] 索引创意 ${c.id} 失败:`, err.message);
      failed++;
    }
  }

  return { total: creativities.length, indexed: totalIndexed, failed };
}

/**
 * 批量索引写作章节
 */
async function indexAllChapters(config, options = {}) {
  const db = getDb();
  if (!db) return { total: 0, indexed: 0, failed: 0 };

  const chapters = db.prepare(
    "SELECT id, title, content, board_id FROM writing_chapters WHERE content != ''"
  ).all();

  console.log(`[RAG] 开始批量索引 ${chapters.length} 个章节`);

  let totalIndexed = 0;
  let failed = 0;

  for (const ch of chapters) {
    try {
      const fullContent = `${ch.title}\n\n${ch.content}`;
      const result = await indexContent('chapter', ch.id, fullContent, {
        title: ch.title,
        status: 'active',
      }, config);
      
      totalIndexed += result.indexed;
    } catch (err) {
      console.warn(`[RAG] 索引章节 ${ch.id} 失败:`, err.message);
      failed++;
    }
  }

  return { total: chapters.length, indexed: totalIndexed, failed };
}

/**
 * 批量索引看板卡片
 */
async function indexAllBoardCards(config, options = {}) {
  const db = getDb();
  if (!db) return { total: 0, indexed: 0, failed: 0 };

  const items = db.prepare(
    "SELECT id, title, content, board_id FROM board_canvas_items WHERE content != '' OR title != ''"
  ).all();

  console.log(`[RAG] 开始批量索引 ${items.length} 个看板卡片`);

  let totalIndexed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const fullContent = `${item.title}\n\n${item.content || ''}`;
      if (!fullContent.trim()) continue;
      
      const result = await indexContent('card', item.id, fullContent, {
        title: item.title,
        status: 'active',
      }, config);
      
      totalIndexed += result.indexed;
    } catch (err) {
      console.warn(`[RAG] 索引卡片 ${item.id} 失败:`, err.message);
      failed++;
    }
  }

  return { total: items.length, indexed: totalIndexed, failed };
}

/**
 * 重建全部索引
 */
async function rebuildAllIndexes(config, options = {}) {
  console.log('[RAG] 开始重建全部索引...');

  const results = {};

  // 每个类型独立执行，互不影响
  try {
    results.creativities = await indexAllCreativities(config, options);
    console.log(`[RAG] 创意索引完成: ${JSON.stringify(results.creativities)}`);
  } catch (err) {
    console.error('[RAG] 创意索引异常:', err.message);
    results.creativities = { total: 0, indexed: 0, failed: 1, error: err.message };
  }

  try {
    results.chapters = await indexAllChapters(config, options);
    console.log(`[RAG] 章节索引完成: ${JSON.stringify(results.chapters)}`);
  } catch (err) {
    console.error('[RAG] 章节索引异常:', err.message);
    results.chapters = { total: 0, indexed: 0, failed: 1, error: err.message };
  }

  try {
    results.cards = await indexAllBoardCards(config, options);
    console.log(`[RAG] 卡片索引完成: ${JSON.stringify(results.cards)}`);
  } catch (err) {
    console.error('[RAG] 卡片索引异常:', err.message);
    results.cards = { total: 0, indexed: 0, failed: 1, error: err.message };
  }

  const total = results.creativities.total + results.chapters.total + results.cards.total;
  const indexed = results.creativities.indexed + results.chapters.indexed + results.cards.indexed;

  console.log(`[RAG] 重建完成: 总计 ${total} 条数据, 索引 ${indexed} 个分块`);

  return { total, indexed, details: results };
}

/**
 * 清空全部索引
 */
function clearAllIndexes() {
  const db = getDb();
  if (!db) return 0;

  const result = db.prepare('DELETE FROM rag_embeddings').run();
  logIndex('clear', 'all', null, result.changes, 'success');

  return result.changes;
}

/**
 * 记录索引日志
 */
function logIndex(action, sourceType, sourceId, chunksCount, status, errorMessage = null, embeddingModel = null) {
  const db = getDb();
  if (!db) return;

  try {
    db.prepare(`
      INSERT INTO rag_index_logs (id, action, source_type, source_id, chunks_count, status, error_message, embedding_model, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      generateId(),
      action,
      sourceType,
      sourceId,
      chunksCount,
      status,
      errorMessage,
      embeddingModel,
      new Date().toISOString()
    );
  } catch (err) {
    console.warn('[RAG] 记录日志失败:', err.message);
  }
}

/**
 * 获取索引日志
 */
function getIndexLogs(limit = 20) {
  const db = getDb();
  if (!db) return [];

  try {
    return db.prepare(`
      SELECT * FROM rag_index_logs 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);
  } catch (e) {
    // rag_index_logs 表可能尚未创建
    console.warn('[RAG] 获取索引日志失败，表可能尚未创建:', e.message);
    return [];
  }
}

/**
 * 获取统计信息
 */
function getStats() {
  return getSearchStats();
}

/**
 * 获取当前 Embedding 模型信息
 */
function getModelInfo(config) {
  return getAvailableModel(config);
}

module.exports = {
  // 核心功能
  indexContent,
  deleteIndex,
  updateIndexStatus,
  
  // 批量索引
  indexAllCreativities,
  indexAllChapters,
  indexAllBoardCards,
  rebuildAllIndexes,
  clearAllIndexes,
  
  // 检索
  search,
  smartSearch,
  formatForPrompt,
  
  // 统计与日志
  getStats,
  getIndexLogs,
  getModelInfo,
  
  // 工具函数
  smartChunk,
  getChunkStats,
  cosineSimilarity,
  
  // 配置
  SEARCH_CONFIG,
};

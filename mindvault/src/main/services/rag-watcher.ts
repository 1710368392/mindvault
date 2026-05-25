// @ts-nocheck
/**
 * RAG 数据变更监听器
 * 监听创意、看板、章节等数据变更，自动触发索引更新
 */

const { ipcMain } = require('electron');
const ragService = require('./rag-service');

// AI 配置缓存
let cachedConfig = null;

/**
 * 设置 AI 配置（由外部调用）
 */
function setAIConfig(config) {
  cachedConfig = config;
}

/**
 * 获取 AI 配置
 */
function getAIConfig() {
  return cachedConfig;
}

// 索引任务队列（防抖）
const indexQueue = new Map();
let queueTimer = null;

/**
 * 队列索引任务
 */
function queueIndexJob(sourceType, sourceId, action, options = {}) {
  const key = `${sourceType}:${sourceId}`;
  
  indexQueue.set(key, {
    sourceType,
    sourceId,
    action,
    options,
    timestamp: Date.now(),
  });

  // 延迟处理，合并短时间内的多次变更
  if (!queueTimer) {
    queueTimer = setTimeout(() => {
      processQueue();
      queueTimer = null;
    }, 1000);
  }
}

/**
 * 处理索引队列
 */
async function processQueue() {
  if (indexQueue.size === 0) return;

  const jobs = Array.from(indexQueue.values());
  indexQueue.clear();

  console.log(`[RAG-Watcher] 处理 ${jobs.length} 个索引任务`);

  const config = getAIConfig();

  for (const job of jobs) {
    try {
      await processIndexJob(job, config);
    } catch (err) {
      console.error(`[RAG-Watcher] 处理任务失败:`, err.message);
    }
  }
}

/**
 * 处理单个索引任务
 */
async function processIndexJob(job, config) {
  const { sourceType, sourceId, action, options } = job;

  switch (action) {
    case 'index':
    case 'reindex':
      await indexSource(sourceType, sourceId, config, options);
      break;
    case 'delete':
      ragService.deleteIndex(sourceType, sourceId);
      break;
    case 'update-status':
      ragService.updateIndexStatus(sourceType, sourceId, options.status);
      break;
  }
}

/**
 * 索引单个数据源
 */
async function indexSource(sourceType, sourceId, config, options = {}) {
  const repo = require('../db/repository');
  const db = repo.db;
  if (!db) return;

  try {
    switch (sourceType) {
      case 'creativity': {
        const row = db.prepare(
          "SELECT title, content, status FROM creativities WHERE id = ?"
        ).get(sourceId);
        
        if (row && row.content) {
          const fullContent = `${row.title || ''}\n\n${row.content}`;
          await ragService.indexContent('creativity', sourceId, fullContent, {
            title: row.title,
            status: row.status,
          }, config);
        } else {
          // 内容为空或已删除，清理索引
          ragService.deleteIndex('creativity', sourceId);
        }
        break;
      }

      case 'chapter': {
        const row = db.prepare(
          "SELECT title, content FROM writing_chapters WHERE id = ?"
        ).get(sourceId);
        
        if (row && row.content) {
          const fullContent = `${row.title || ''}\n\n${row.content}`;
          await ragService.indexContent('chapter', sourceId, fullContent, {
            title: row.title,
            status: 'active',
          }, config);
        } else {
          ragService.deleteIndex('chapter', sourceId);
        }
        break;
      }

      case 'card': {
        const row = db.prepare(
          "SELECT title, content FROM board_canvas_items WHERE id = ?"
        ).get(sourceId);
        
        if (row && (row.title || row.content)) {
          const fullContent = `${row.title || ''}\n\n${row.content || ''}`;
          await ragService.indexContent('card', sourceId, fullContent, {
            title: row.title,
            status: 'active',
          }, config);
        } else {
          ragService.deleteIndex('card', sourceId);
        }
        break;
      }

      case 'tag': {
        const row = db.prepare(
          "SELECT name, color FROM tags WHERE id = ?"
        ).get(sourceId);
        
        if (row) {
          await ragService.indexContent('tag', sourceId, row.name, {
            title: row.name,
            status: 'active',
          }, config);
        } else {
          ragService.deleteIndex('tag', sourceId);
        }
        break;
      }

      default:
        console.warn(`[RAG-Watcher] 未知的数据源类型: ${sourceType}`);
    }
  } catch (err) {
    console.error(`[RAG-Watcher] 索引 ${sourceType}/${sourceId} 失败:`, err.message);
  }
}

/**
 * 手动触发索引（供外部调用）
 */
async function triggerIndex(sourceType, sourceId, action = 'index', options = {}) {
  const config = getAIConfig();
  await processIndexJob({ sourceType, sourceId, action, options }, config);
}

/**
 * 批量重建索引
 */
async function rebuildAllIndexes(config) {
  return await ragService.rebuildAllIndexes(config);
}

/**
 * 初始化监听器
 */
function setupRagWatcher() {
  console.log('[RAG-Watcher] 初始化数据变更监听器');

  // 监听创意变更
  ipcMain.on('rag:creativity:created', (event, data) => {
    queueIndexJob('creativity', data.id, 'index');
  });

  ipcMain.on('rag:creativity:updated', (event, data) => {
    queueIndexJob('creativity', data.id, 'reindex');
  });

  ipcMain.on('rag:creativity:deleted', (event, id) => {
    queueIndexJob('creativity', id, 'update-status', { status: 'trashed' });
  });

  ipcMain.on('rag:creativity:restored', (event, id) => {
    queueIndexJob('creativity', id, 'reindex');
  });

  ipcMain.on('rag:creativity:permanent-deleted', (event, id) => {
    queueIndexJob('creativity', id, 'delete');
  });

  // 监听章节变更
  ipcMain.on('rag:chapter:created', (event, data) => {
    queueIndexJob('chapter', data.id, 'index');
  });

  ipcMain.on('rag:chapter:updated', (event, data) => {
    queueIndexJob('chapter', data.id, 'reindex');
  });

  ipcMain.on('rag:chapter:deleted', (event, id) => {
    queueIndexJob('chapter', id, 'delete');
  });

  // 监听看板卡片变更
  ipcMain.on('rag:card:created', (event, data) => {
    queueIndexJob('card', data.id, 'index');
  });

  ipcMain.on('rag:card:updated', (event, data) => {
    queueIndexJob('card', data.id, 'reindex');
  });

  ipcMain.on('rag:card:deleted', (event, id) => {
    queueIndexJob('card', id, 'delete');
  });

  // 监听标签变更
  ipcMain.on('rag:tag:created', (event, data) => {
    queueIndexJob('tag', data.id, 'index');
  });

  ipcMain.on('rag:tag:updated', (event, data) => {
    queueIndexJob('tag', data.id, 'reindex');
  });

  ipcMain.on('rag:tag:deleted', (event, id) => {
    queueIndexJob('tag', id, 'delete');
  });

  console.log('[RAG-Watcher] 监听器已启动');
}

module.exports = {
  setupRagWatcher,
  setAIConfig,
  getAIConfig,
  triggerIndex,
  queueIndexJob,
  rebuildAllIndexes,
};

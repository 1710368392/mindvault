// @ts-nocheck
/**
 * RAG 知识库 IPC 处理器（增强版）
 * 支持多模型 Embedding（优先 DeepSeek）
 */

const { ipcMain } = require('electron');
const ragService = require('../services/rag-service');
const ragWatcher = require('../services/rag-watcher');

function registerRAGHandlers() {
  console.log('[IPC] RAG处理器已注册');

  // 索引内容
  ipcMain.handle('rag:index-content', async (_event, sourceType, sourceId, content, config, options = {}) => {
    try {
      const result = await ragService.indexContent(sourceType, sourceId, content, options, config);
      return { success: true, count: result.indexed, model: result.model };
    } catch (err) {
      console.error('[IPC] RAG索引内容失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 检索
  ipcMain.handle('rag:search', async (_event, query, config, options = {}) => {
    try {
      const results = await ragService.search(query, config, options);
      return { success: true, data: results };
    } catch (err) {
      console.error('[IPC] RAG搜索失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 智能检索
  ipcMain.handle('rag:smart-search', async (_event, query, context, config, options = {}) => {
    try {
      const results = await ragService.smartSearch(query, context, config, options);
      return { success: true, data: results };
    } catch (err) {
      console.error('[IPC] RAG智能搜索失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 格式化检索结果用于 Prompt
  ipcMain.handle('rag:format-for-prompt', async (_event, results) => {
    try {
      const text = ragService.formatForPrompt(results);
      return { success: true, data: text };
    } catch (err) {
      console.error('[IPC] RAG格式化失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 删除索引
  ipcMain.handle('rag:delete-index', async (_event, sourceType, sourceId) => {
    try {
      const count = ragService.deleteIndex(sourceType, sourceId);
      return { success: true, count };
    } catch (err) {
      console.error('[IPC] RAG删除索引失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 更新索引状态
  ipcMain.handle('rag:update-status', async (_event, sourceType, sourceId, status) => {
    try {
      const count = ragService.updateIndexStatus(sourceType, sourceId, status);
      return { success: true, count };
    } catch (err) {
      console.error('[IPC] RAG更新状态失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取统计信息
  ipcMain.handle('rag:stats', async () => {
    try {
      const stats = ragService.getStats();
      return { success: true, data: stats };
    } catch (err) {
      console.error('[IPC] RAG统计失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取索引日志
  ipcMain.handle('rag:logs', async (_event, limit = 20) => {
    try {
      const logs = ragService.getIndexLogs(limit);
      return { success: true, data: logs };
    } catch (err) {
      console.error('[IPC] RAG日志获取失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取模型信息
  ipcMain.handle('rag:model-info', async (_event, config) => {
    try {
      const info = ragService.getModelInfo(config);
      return { success: true, data: info };
    } catch (err) {
      console.error('[IPC] RAG模型信息获取失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 批量索引创意
  ipcMain.handle('rag:index-all-creativities', async (_event, config, options = {}) => {
    try {
      const result = await ragService.indexAllCreativities(config, options);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] RAG全量索引创意失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 批量索引章节
  ipcMain.handle('rag:index-all-chapters', async (_event, config, options = {}) => {
    try {
      const result = await ragService.indexAllChapters(config, options);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] RAG全量索引章节失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 批量索引看板卡片
  ipcMain.handle('rag:index-all-cards', async (_event, config, options = {}) => {
    try {
      const result = await ragService.indexAllBoardCards(config, options);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] RAG全量索引卡片失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 重建全部索引
  ipcMain.handle('rag:rebuild-all', async (_event, config, options = {}) => {
    try {
      const result = await ragService.rebuildAllIndexes(config, options);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] RAG重建索引失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 清空全部索引
  ipcMain.handle('rag:clear-all', async () => {
    try {
      const count = ragService.clearAllIndexes();
      return { success: true, count };
    } catch (err) {
      console.error('[IPC] RAG清空索引失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 设置 AI 配置（用于自动索引）
  ipcMain.handle('rag:set-config', async (_event, config) => {
    try {
      ragWatcher.setAIConfig(config);
      return { success: true };
    } catch (err) {
      console.error('[IPC] RAG设置配置失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 手动触发索引
  ipcMain.handle('rag:trigger-index', async (_event, sourceType, sourceId, action = 'index') => {
    try {
      await ragWatcher.triggerIndex(sourceType, sourceId, action);
      return { success: true };
    } catch (err) {
      console.error('[IPC] RAG触发索引失败:', err.message);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerRAGHandlers };

// @ts-nocheck
/**
 * RAG 管理 IPC 处理器
 */

const { ipcMain } = require('electron');
const ragService = require('../services/rag-service');
const ragWatcher = require('../services/rag-watcher');

function registerRagManagementHandlers() {
  // 获取 RAG 统计信息
  ipcMain.handle('rag:stats', () => {
    try {
      return ragService.getStats();
    } catch (e) {
      console.error('[IPC] 获取 RAG 统计失败:', e);
      return null;
    }
  });

  // 获取索引日志
  ipcMain.handle('rag:logs', (event, limit = 20) => {
    try {
      return ragService.getIndexLogs(limit);
    } catch (e) {
      console.error('[IPC] 获取 RAG 日志失败:', e);
      return [];
    }
  });

  // 获取当前 Embedding 模型信息
  ipcMain.handle('rag:model-info', (event, config) => {
    try {
      return ragService.getModelInfo(config);
    } catch (e) {
      console.error('[IPC] 获取模型信息失败:', e);
      return null;
    }
  });

  // 手动索引单个内容
  ipcMain.handle('rag:index', async (event, sourceType, sourceId, content, options, config) => {
    try {
      const result = await ragService.indexContent(sourceType, sourceId, content, options, config);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] 索引失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 删除索引
  ipcMain.handle('rag:delete-index', (event, sourceType, sourceId) => {
    try {
      const count = ragService.deleteIndex(sourceType, sourceId);
      return { success: true, data: { deleted: count } };
    } catch (e) {
      console.error('[IPC] 删除索引失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 批量索引创意
  ipcMain.handle('rag:index-creativities', async (event, config, options) => {
    try {
      const result = await ragService.indexAllCreativities(config, options);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] 批量索引创意失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 批量索引章节
  ipcMain.handle('rag:index-chapters', async (event, config, options) => {
    try {
      const result = await ragService.indexAllChapters(config, options);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] 批量索引章节失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 批量索引看板卡片
  ipcMain.handle('rag:index-cards', async (event, config, options) => {
    try {
      const result = await ragService.indexAllBoardCards(config, options);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] 批量索引卡片失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 重建全部索引
  ipcMain.handle('rag:rebuild-all', async (event, config, options) => {
    try {
      const result = await ragService.rebuildAllIndexes(config, options);
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] 重建索引失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 清空全部索引
  ipcMain.handle('rag:clear-all', () => {
    try {
      const count = ragService.clearAllIndexes();
      return { success: true, data: { deleted: count } };
    } catch (e) {
      console.error('[IPC] 清空索引失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 检索
  ipcMain.handle('rag:search', async (event, query, config, options) => {
    try {
      const results = await ragService.search(query, config, options);
      return { success: true, data: results };
    } catch (e) {
      console.error('[IPC] 检索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 智能检索
  ipcMain.handle('rag:smart-search', async (event, query, context, config, options) => {
    try {
      const results = await ragService.smartSearch(query, context, config, options);
      return { success: true, data: results };
    } catch (e) {
      console.error('[IPC] 智能检索失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 格式化检索结果用于 Prompt
  ipcMain.handle('rag:format-for-prompt', async (event, results) => {
    try {
      const text = ragService.formatForPrompt(results);
      return { success: true, data: text };
    } catch (e) {
      console.error('[IPC] 格式化失败:', e);
      return { success: false, error: e.message };
    }
  });

  // 设置 AI 配置（用于自动索引）
  ipcMain.handle('rag:set-config', (event, config) => {
    try {
      ragWatcher.setAIConfig(config);
      return { success: true };
    } catch (e) {
      console.error('[IPC] 设置配置失败:', e);
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] RAG 管理处理器已注册');
}

module.exports = { registerRagManagementHandlers };

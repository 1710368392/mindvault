// @ts-nocheck
const { ipcMain } = require('electron');
const statsService = require('../services/ai-usage-stats');

function registerAIUsageStatsHandlers() {
  console.log('[IPC] AI使用统计处理器已注册');

  ipcMain.handle('ai-stats:record', async (_event, data) => {
    try {
      statsService.recordUsage(data);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai-stats:get', async (_event, period) => {
    try {
      const stats = statsService.getStats(period || '7d');
      return { success: true, data: stats };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai-stats:top-tools', async (_event, limit) => {
    try {
      const tools = statsService.getTopTools(limit || 10);
      return { success: true, data: tools };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('ai-stats:clear', async () => {
    try {
      statsService.clearStats();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerAIUsageStatsHandlers };

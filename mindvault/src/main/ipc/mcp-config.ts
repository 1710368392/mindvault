// @ts-nocheck
const { ipcMain } = require('electron');
const mcpConfigService = require('../services/mcp-config-service');
const { mcpBridge } = require('../services/mcp-bridge');

function registerMCPConfigHandlers() {
  console.log('[IPC] MCP配置处理器已注册');

  // 初始化预置服务器
  ipcMain.handle('mcp-config:init-presets', async () => {
    try {
      mcpConfigService.initPresetServers();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 列出所有服务器配置
  ipcMain.handle('mcp-config:list', async () => {
    try {
      const data = mcpConfigService.listServers();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取单个服务器
  ipcMain.handle('mcp-config:get', async (_event, serverId) => {
    try {
      const data = mcpConfigService.getServer(serverId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 创建服务器
  ipcMain.handle('mcp-config:create', async (_event, server) => {
    try {
      const data = mcpConfigService.createServer(server);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新服务器
  ipcMain.handle('mcp-config:update', async (_event, serverId, updates) => {
    try {
      const result = mcpConfigService.updateServer(serverId, updates);
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除服务器
  ipcMain.handle('mcp-config:delete', async (_event, serverId) => {
    try {
      const result = mcpConfigService.deleteServer(serverId);
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 切换启用状态
  ipcMain.handle('mcp-config:toggle', async (_event, serverId) => {
    try {
      const data = mcpConfigService.toggleServer(serverId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 连接服务器（同时更新状态）
  ipcMain.handle('mcp-config:connect', async (_event, serverId) => {
    try {
      const config = mcpConfigService.getServer(serverId);
      if (!config) {
        return { success: false, error: '服务器配置不存在' };
      }
      const result = await mcpBridge.connectServer(config);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 断开服务器
  ipcMain.handle('mcp-config:disconnect', async (_event, serverId) => {
    try {
      const result = await mcpBridge.disconnectServer(serverId);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取用量统计
  ipcMain.handle('mcp-config:usage-stats', async (_event, serverId, days) => {
    try {
      const data = mcpConfigService.getUsageStats(serverId, days || 30);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取用量摘要
  ipcMain.handle('mcp-config:usage-summary', async (_event, serverId) => {
    try {
      const data = mcpConfigService.getUsageSummary(serverId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 初始化所有启用的服务器（应用启动时调用）
  ipcMain.handle('mcp-config:initialize-all', async () => {
    try {
      // 1. 初始化预置服务器
      mcpConfigService.initPresetServers();
      // 2. 获取所有启用的服务器配置
      const configs = mcpConfigService.listServers().filter(s => s.enabled);
      // 3. 调用 mcpBridge.initialize(configs)
      await mcpBridge.initialize(configs);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerMCPConfigHandlers };

// @ts-nocheck
/**
 * AI 规则系统 IPC 处理器
 */

const { ipcMain } = require('electron');
const aiRules = require('../services/ai-rules');

function registerAIRulesHandlers() {
  console.log('[IPC] AI规则处理器已注册');

  // 获取规则列表
  ipcMain.handle('ai:rules:list', async (_event, options = {}) => {
    try {
      const result = aiRules.getRules(options);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 获取规则列表失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取单条规则
  ipcMain.handle('ai:rules:get', async (_event, id) => {
    try {
      if (!id) {
        return { success: false, error: '规则ID不能为空' };
      }
      const result = aiRules.getRuleById(id);
      if (result) {
        return { success: true, data: result };
      }
      return { success: false, error: '未找到指定规则' };
    } catch (err) {
      console.error('[IPC] 获取规则失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 创建规则
  ipcMain.handle('ai:rules:create', async (_event, rule) => {
    try {
      if (!rule || !rule.name || !rule.content) {
        return { success: false, error: '规则名称和内容不能为空' };
      }
      const result = aiRules.createRule(rule);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 创建规则失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 更新规则
  ipcMain.handle('ai:rules:update', async (_event, id, updates) => {
    try {
      if (!id) {
        return { success: false, error: '规则ID不能为空' };
      }
      const result = aiRules.updateRule(id, updates);
      if (result) {
        return { success: true, data: result };
      }
      return { success: false, error: '未找到指定规则' };
    } catch (err) {
      console.error('[IPC] 更新规则失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 删除规则
  ipcMain.handle('ai:rules:delete', async (_event, id) => {
    try {
      if (!id) {
        return { success: false, error: '规则ID不能为空' };
      }
      const result = aiRules.deleteRule(id);
      if (result) {
        return { success: true };
      }
      return { success: false, error: '未找到指定规则' };
    } catch (err) {
      console.error('[IPC] 删除规则失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 切换规则启用状态
  ipcMain.handle('ai:rules:toggle', async (_event, id) => {
    try {
      if (!id) {
        return { success: false, error: '规则ID不能为空' };
      }
      const result = aiRules.toggleRule(id);
      if (result) {
        return { success: true, data: result };
      }
      return { success: false, error: '未找到指定规则' };
    } catch (err) {
      console.error('[IPC] 切换规则状态失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 获取当前生效的规则（用于构建上下文）
  ipcMain.handle('ai:rules:get-active', async (_event, type = 'global') => {
    try {
      const result = aiRules.getActiveRules(type);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 获取生效规则失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 检查规则 token 限制
  ipcMain.handle('ai:rules:check-tokens', async (_event, rules, maxTokens) => {
    try {
      const result = aiRules.checkRulesTokenLimit(rules, maxTokens);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 检查规则token失败:', err.message);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerAIRulesHandlers };

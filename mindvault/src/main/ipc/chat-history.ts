// @ts-nocheck
/**
 * AI 聊天记录 IPC 处理器
 */

const { ipcMain } = require('electron');
const chatHistory = require('../services/chat-history-service');

function registerChatHistoryHandlers() {
  console.log('[IPC] 聊天记录处理器已注册');

  ipcMain.handle('chat:create-window', async (_event, title) => {
    try {
      const result = chatHistory.createWindow(title);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 创建聊天窗口失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:list-windows', async (_event, options) => {
    try {
      const result = chatHistory.listWindows(options || {});
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 列出聊天窗口失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:get-window', async (_event, windowId) => {
    try {
      const result = chatHistory.getWindow(windowId);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 获取聊天窗口失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:update-window', async (_event, windowId, updates) => {
    try {
      const result = chatHistory.updateWindow(windowId, updates);
      return { success: result };
    } catch (err) {
      console.error('[IPC] 更新聊天窗口失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:delete-window', async (_event, windowId) => {
    try {
      const result = chatHistory.deleteWindow(windowId);
      return { success: result };
    } catch (err) {
      console.error('[IPC] 删除聊天窗口失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:add-message', async (_event, windowId, message) => {
    try {
      const result = chatHistory.addMessage(windowId, message);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 添加消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:add-messages', async (_event, windowId, messages) => {
    try {
      const result = chatHistory.addMessages(windowId, messages);
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 批量添加消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:get-messages', async (_event, windowId, options) => {
    try {
      const result = chatHistory.getMessages(windowId, options || {});
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 获取消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:delete-message', async (_event, messageId) => {
    try {
      const result = chatHistory.deleteMessage(messageId);
      return { success: result };
    } catch (err) {
      console.error('[IPC] 删除消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:clear-messages', async (_event, windowId) => {
    try {
      const result = chatHistory.clearMessages(windowId);
      return { success: result };
    } catch (err) {
      console.error('[IPC] 清空消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:search-messages', async (_event, query, options) => {
    try {
      const result = chatHistory.searchMessages(query, options || {});
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 搜索消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:replace-window-messages', async (_event, windowId, messages) => {
    try {
      const result = chatHistory.replaceWindowMessages(windowId, messages);
      return { success: result };
    } catch (err) {
      console.error('[IPC] 替换消息失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:migrate-from-local-storage', async (_event, windowsData) => {
    try {
      const result = chatHistory.migrateFromLocalStorage(windowsData);
      return result;
    } catch (err) {
      console.error('[IPC] 迁移数据失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('chat:get-stats', async () => {
    try {
      const result = chatHistory.getStats();
      return { success: true, data: result };
    } catch (err) {
      console.error('[IPC] 获取统计失败:', err.message);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerChatHistoryHandlers };

// @ts-nocheck
const { ipcMain } = require('electron');
const templateService = require('../services/prompt-template-service');

function registerPromptTemplateHandlers() {
  console.log('[IPC] Prompt模板处理器已注册');

  ipcMain.handle('prompt-template:list', async (_event, category) => {
    try {
      const data = templateService.listTemplates(category || undefined);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:get', async (_event, templateId) => {
    try {
      const data = templateService.getTemplate(templateId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:create', async (_event, template) => {
    try {
      const data = templateService.createTemplate(template);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:update', async (_event, templateId, updates) => {
    try {
      const result = templateService.updateTemplate(templateId, updates);
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:delete', async (_event, templateId) => {
    try {
      const result = templateService.deleteTemplate(templateId);
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:render', async (_event, templateId, variables) => {
    try {
      const data = templateService.renderTemplate(templateId, variables);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:categories', async () => {
    try {
      const data = templateService.getCategories();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('prompt-template:init-presets', async () => {
    try {
      templateService.initPresetTemplates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerPromptTemplateHandlers };

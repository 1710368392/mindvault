// @ts-nocheck
const { ipcMain } = require('electron');
const workflowService = require('../services/workflow-service');

function registerWorkflowHandlers() {
  console.log('[IPC] 工作流处理器已注册');

  ipcMain.handle('workflow:init-presets', async () => {
    try {
      const count = workflowService.initPresets();
      return { success: true, count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:list', async () => {
    try {
      const workflows = workflowService.listWorkflows();
      return { success: true, data: workflows };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:get', async (_event, id) => {
    try {
      const workflow = workflowService.getWorkflow(id);
      return { success: true, data: workflow };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:create', async (_event, workflow) => {
    try {
      const result = workflowService.createWorkflow(workflow);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:update', async (_event, id, updates) => {
    try {
      const result = workflowService.updateWorkflow(id, updates);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:delete', async (_event, id) => {
    try {
      const result = workflowService.deleteWorkflow(id);
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('workflow:record-run', async (_event, id) => {
    try {
      workflowService.recordRun(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerWorkflowHandlers };

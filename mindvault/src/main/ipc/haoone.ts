// @ts-nocheck
/**
 * haoone IPC 处理器
 * 注册 haoone 相关的所有 IPC 通道
 */

const { ipcMain } = require('electron');
const haooneService = require('../services/haoone-service');

function registerHaooneHandlers() {
  console.log('[IPC] haoone 处理器已注册');

  // 检查环境
  ipcMain.handle('haoone:check-environment', async () => {
    try {
      const result = haooneService.checkEnvironment();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 转录单个文件
  ipcMain.handle('haoone:transcribe', async (event, params) => {
    try {
      const { filePath, outputDir, model, language, timelineName, enableAiCorrection, maxSubtitleLength } = params || {};
      const result = haooneService.transcribe(filePath, { outputDir, model, language, timelineName, enableAiCorrection, maxSubtitleLength });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 批量转录
  ipcMain.handle('haoone:batch-transcribe', async (event, params) => {
    try {
      const { filePaths, outputDir, model, language, enableAiCorrection } = params || {};
      const result = haooneService.batchTranscribe(filePaths, { outputDir, model, language, enableAiCorrection });
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 列出模型
  ipcMain.handle('haoone:list-models', async () => {
    try {
      const result = haooneService.listModels();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取配置
  ipcMain.handle('haoone:get-config', async () => {
    try {
      const result = haooneService.getConfig();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 创建项目
  ipcMain.handle('haoone:create-project', async (event, projectName) => {
    try {
      const result = haooneService.createProject(projectName);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除项目
  ipcMain.handle('haoone:delete-project', async (event, projectName) => {
    try {
      const result = haooneService.deleteProject(projectName);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 文稿格式化
  ipcMain.handle('haoone:format-draft', async (event, filePath) => {
    try {
      const result = haooneService.formatDraft(filePath);
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取项目列表
  ipcMain.handle('haoone:get-project-list', async () => {
    try {
      const result = haooneService.getProjectList();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取热词配置
  ipcMain.handle('haoone:get-hotwords', async () => {
    try {
      const result = haooneService.getHotwords();
      return { success: true, data: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerHaooneHandlers };

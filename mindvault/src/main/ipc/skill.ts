// @ts-nocheck
/**
 * 技能系统 IPC 处理器
 * 注册技能相关的所有 IPC 通道
 */

const { ipcMain } = require('electron');
const skillService = require('../services/skill-service');

function registerSkillHandlers() {
  console.log('[IPC] 技能处理器已注册');

  // 加载所有技能
  ipcMain.handle('skill:load-all', async () => {
    try {
      const data = skillService.loadAllSkills();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取所有技能（带缓存）
  ipcMain.handle('skill:list', async () => {
    try {
      const data = skillService.getAllSkills();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取所有分类
  ipcMain.handle('skill:categories', async () => {
    try {
      const data = skillService.getCategories();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 按分类获取技能
  ipcMain.handle('skill:list-by-category', async (_event, category) => {
    try {
      const data = skillService.getSkillsByCategory(category);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取单个技能
  ipcMain.handle('skill:get', async (_event, skillId) => {
    try {
      const data = skillService.getSkill(skillId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 搜索技能
  ipcMain.handle('skill:search', async (_event, query) => {
    try {
      const data = skillService.searchSkills(query);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 检测匹配的技能（用于自然语言唤醒）
  ipcMain.handle('skill:detect', async (_event, input) => {
    try {
      const data = skillService.detectSkills(input);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取技能 prompt 内容
  ipcMain.handle('skill:get-prompt', async (_event, skillId) => {
    try {
      const data = skillService.getSkillPrompt(skillId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 创建技能
  ipcMain.handle('skill:create', async (_event, params) => {
    try {
      const data = skillService.createSkill(params);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新技能
  ipcMain.handle('skill:update', async (_event, skillId, updates) => {
    try {
      const data = skillService.updateSkill(skillId, updates);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除技能
  ipcMain.handle('skill:delete', async (_event, skillId) => {
    try {
      const data = skillService.deleteSkill(skillId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 切换技能启用状态
  ipcMain.handle('skill:toggle', async (_event, skillId) => {
    try {
      const data = skillService.toggleSkill(skillId);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 增加使用次数
  ipcMain.handle('skill:increment-use', async (_event, skillId) => {
    try {
      skillService.incrementUseCount(skillId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 创建分类
  ipcMain.handle('skill:create-category', async (_event, params) => {
    try {
      const data = skillService.createCategory(params);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新分类
  ipcMain.handle('skill:update-category', async (_event, oldName, updates) => {
    try {
      const data = skillService.updateCategory(oldName, updates);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除分类
  ipcMain.handle('skill:delete-category', async (_event, name, moveToCategory) => {
    try {
      const data = skillService.deleteCategory(name, moveToCategory);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerSkillHandlers };

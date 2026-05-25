/**
 * Tool Registry - 工具注册中心
 * 
 * 将所有现有工具转换为 buildTool 格式
 * 支持权限声明、参数校验、结果格式化
 */

import { buildTool, Tool, ToolRegistry } from './Tool';

// ============================================================================
// Types
// ============================================================================

interface LegacyToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties?: Record<string, {
        type: string;
        description?: string;
        enum?: string[];
        default?: any;
      }>;
      required?: string[];
    };
  };
}

// ============================================================================
// Tool Permission Mapping
// ============================================================================

/**
 * 工具权限映射
 * 根据工具名称自动判断权限级别
 */
const TOOL_PERMISSIONS: Record<string, 'read' | 'write' | 'dangerous'> = {
  // 只读工具
  get_current_time: 'read',
  search_creativity: 'read',
  get_creativity_detail: 'read',
  list_creativities: 'read',
  get_random_creativity: 'read',
  get_creativity_stats: 'read',
  list_boards: 'read',
  get_board_overview: 'read',
  search_tags: 'read',
  get_popular_tags: 'read',
  list_tags: 'read',
  search_templates: 'read',
  global_search: 'read',
  search_by_date_range: 'read',
  get_app_stats: 'read',
  get_recent_edits: 'read',
  get_weather: 'read',
  get_weather_forecast: 'read',
  get_weather_alerts: 'read',
  get_music_status: 'read',
  search_music: 'read',
  get_current_context: 'read',
  read_file: 'read',
  list_directory: 'read',
  calculate: 'read',
  list_trash: 'read',

  // 写入工具
  create_creativity: 'write',
  update_creativity: 'write',
  delete_creativity: 'write',
  tag_creativity: 'write',
  link_creativities: 'write',
  toggle_favorite: 'write',
  create_board: 'write',
  update_board: 'write',
  delete_board: 'write',
  add_to_board: 'write',
  remove_from_board: 'write',
  create_tag: 'write',
  update_tag: 'write',
  delete_tag: 'write',
  apply_template: 'write',
  control_music: 'write',
  control_music_advanced: 'write',
  update_settings: 'write',
  create_writing_chapter: 'write',
  web_search: 'write',
  execute_code: 'write',
  create_sticky_note: 'write',
  delete_sticky_note: 'write',
  create_board_folder: 'write',
  add_to_folder: 'write',
  restore_creativity: 'write',
  export_creativities: 'write',
  toggle_weather_alerts: 'write',
  set_weather_briefing_time: 'write',
  set_weather_location_mode: 'write',
  open_city_selector: 'write',
  get_current_weather_location: 'read',
  trigger_forecast_notification: 'write',
  trigger_alert_notification: 'write',
  show_daily_weather_briefing: 'write',
  change_tts_voice: 'write',

  // 危险工具
  permanent_delete_creativity: 'dangerous',
  batch_delete_creativities: 'dangerous',
  clear_trash: 'dangerous',
};

// ============================================================================
// Tool Execution Functions
// ============================================================================

// 导入现有工具执行器
const repo = require('../../db/repository');
const musicLibrary = require('../../services/music-library');
const musicOnline = require('../../services/music-online');
const { webSearch } = require('../../services/ai-service');
const codeExecutor = require('../../services/code-executor');
const fileOps = require('../../services/file-operations');
const { BrowserWindow } = require('electron');

/**
 * 工具执行函数映射
 */
const TOOL_EXECUTORS: Record<string, (input: any) => Promise<any>> = {
  // 基础工具
  get_current_time: async () => {
    const now = new Date();
    return {
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      weekday: now.toLocaleDateString('zh-CN', { weekday: 'long' }),
      timestamp: now.getTime(),
    };
  },

  calculate: async (input) => {
    try {
      const sanitized = input.expression.replace(/[^0-9+\-*/().%\s]/g, '');
      const result = Function(`"use strict"; return (${sanitized})`)();
      return { result, expression: input.expression };
    } catch (error: any) {
      return { error: `计算错误: ${error.message}` };
    }
  },

  // 创意管理
  search_creativity: async (input) => {
    const results = await repo.searchCreativities(input.keyword, input.limit || 10);
    return results;
  },

  create_creativity: async (input) => {
    const creativity = await repo.createCreativity({
      title: input.title,
      content: input.content,
      type: input.type || 'text',
      subtype: input.subtype,
    });
    notifyCreativityChange();
    return creativity;
  },

  update_creativity: async (input) => {
    const { id, ...updates } = input;
    const creativity = await repo.updateCreativity(id, updates);
    notifyCreativityChange();
    return creativity;
  },

  delete_creativity: async (input) => {
    await repo.deleteCreativity(input.id);
    notifyCreativityChange();
    return { success: true, message: '创意已删除' };
  },

  get_creativity_detail: async (input) => {
    return await repo.getCreativityById(input.id);
  },

  list_creativities: async (input) => {
    return await repo.listCreativities(input.limit || 20, input.offset || 0);
  },

  get_random_creativity: async () => {
    return await repo.getRandomCreativity();
  },

  get_creativity_stats: async () => {
    return await repo.getCreativityStats();
  },

  tag_creativity: async (input) => {
    const creativity = await repo.addTagsToCreativity(input.id, input.tags);
    notifyCreativityChange();
    return creativity;
  },

  link_creativities: async (input) => {
    await repo.linkCreativities(input.sourceId, input.targetId);
    return { success: true };
  },

  toggle_favorite: async (input) => {
    const creativity = await repo.toggleFavorite(input.id);
    notifyCreativityChange();
    return creativity;
  },

  // 音乐控制
  get_music_status: async () => {
    return await musicLibrary.getPlaybackState();
  },

  control_music: async (input) => {
    switch (input.action) {
      case 'stop':
        await musicLibrary.stop();
        break;
      case 'pause':
        await musicLibrary.pause();
        break;
      case 'resume':
        await musicLibrary.play();
        break;
    }
    return { success: true, action: input.action };
  },

  search_music: async (input) => {
    const source = input.source || 'all';
    let results: any[] = [];

    if (source === 'local' || source === 'all') {
      const localResults = await musicLibrary.search(input.keyword);
      results.push(...localResults.map((r: any) => ({ ...r, source: 'local' })));
    }

    if (source === 'online' || source === 'all') {
      const onlineResults = await musicOnline.search(input.keyword);
      results.push(...onlineResults.map((r: any) => ({ ...r, source: 'online' })));
    }

    return results;
  },

  // 代码执行
  execute_code: async (input) => {
    const language = input.language || 'javascript';
    return await codeExecutor.execute(input.code, language);
  },

  // 文件操作
  read_file: async (input) => {
    return await fileOps.readFile(input.path);
  },

  list_directory: async (input) => {
    return await fileOps.listDirectory(input.path);
  },

  // 联网搜索
  web_search: async (input) => {
    return await webSearch(input.query);
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function notifyCreativityChange() {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send('creativity:changed');
      }
    }
  } catch (e) {
    // ignore
  }
}

/**
 * 将旧版工具定义转换为新版 Tool 格式
 */
function convertLegacyToolToNewFormat(legacy: LegacyToolDefinition): Tool {
  const { name, description, parameters } = legacy.function;
  const permission = TOOL_PERMISSIONS[name] || 'write';
  const executor = TOOL_EXECUTORS[name];

  return buildTool({
    name,
    description,
    permission,
    inputSchema: parameters,
    readOnly: permission === 'read',
    execute: async (input) => {
      if (executor) {
        return await executor(input);
      }
      // 如果没有找到执行器，返回错误
      return { error: `Tool "${name}" executor not implemented` };
    },
  });
}

// ============================================================================
// Create Tool Registry
// ============================================================================

/**
 * 创建完整的工具注册表
 */
export function createFullToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // 从旧版工具定义导入
  const { TOOL_DEFINITIONS } = require('./tool-executor');

  for (const legacyDef of TOOL_DEFINITIONS) {
    const tool = convertLegacyToolToNewFormat(legacyDef);
    registry.register(tool);
  }

  return registry;
}

/**
 * 获取所有工具定义（新版格式）
 */
export function getAllTools(): Tool[] {
  const registry = createFullToolRegistry();
  return registry.getAll();
}

/**
 * 获取工具注册表
 */
export function getToolRegistry(): ToolRegistry {
  return createFullToolRegistry();
}

/**
 * 执行工具
 */
export async function executeTool(name: string, input: any): Promise<any> {
  const executor = TOOL_EXECUTORS[name];
  if (executor) {
    return await executor(input);
  }
  return { error: `Unknown tool: ${name}` };
}

export default createFullToolRegistry;
